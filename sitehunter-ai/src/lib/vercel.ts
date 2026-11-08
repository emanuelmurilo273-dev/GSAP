import { createHash } from "node:crypto";
import { env } from "./env";
import { log } from "./logger";
import { buildRootBundle, type BundleFile } from "./previewBundle";
import type { SiteContent } from "./site/types";

// Prévias públicas na Vercel, pela API REST oficial (https://vercel.com/docs/rest-api).
// - Um projeto por site (nome estável): cada atualização é um novo deploy de produção e a URL
//   https://<projeto>.vercel.app continua a mesma.
// - Os arquivos são enviados por hash (POST /v2/files) e o deploy os referencia (POST /v13/deployments).
// - O token (VERCEL_TOKEN) fica só no servidor: não vai ao navegador, ao banco nem aos logs.
// - Só a página da prévia e os recursos dela (fotos livres e 3D, licenças CC0/MIT) saem do app; nunca o painel nem os leads.

const API = "https://api.vercel.com";

export type VercelConfig = { token: string; teamId: string | null; prefix: string };
export type Fetcher = typeof fetch;

export function vercelConfig(): VercelConfig | null {
  const token = env.vercelToken;
  if (!token) return null;
  const team = env.vercelTeamId;
  return { token, teamId: team && /^[\w-]{3,64}$/.test(team) ? team : null, prefix: (env.vercelProjectPrefix ?? "hunter").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20) || "hunter" };
}

const teamCache = new Map<string, string | null>();
/** Sem VERCEL_TEAM_ID, descobre o escopo da conta pelo próprio token (a API exige o teamId até em conta pessoal). */
export async function withTeam(cfg: VercelConfig, f: Fetcher): Promise<VercelConfig> {
  if (cfg.teamId) return cfg;
  const key = createHash("sha256").update(cfg.token).digest("hex");
  if (!teamCache.has(key)) {
    let id: string | null = null;
    try {
      const r = await f(`${API}/v2/user`, { headers: { Authorization: `Bearer ${cfg.token}` }, signal: AbortSignal.timeout(20_000) });
      if (r.ok) { const d = (await r.json()) as { user?: { defaultTeamId?: string | null } }; id = d.user?.defaultTeamId ?? null; }
      else if (r.status === 401 || r.status === 403) throw explain(r.status, null, "ler a conta do token");
    } catch (e) { if (e instanceof VercelError) throw e; }
    teamCache.set(key, id);
  }
  return { ...cfg, teamId: teamCache.get(key) ?? null };
}

export class VercelError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null = null) { super(message); }
}

const qs = (cfg: VercelConfig, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams(extra);
  if (cfg.teamId) p.set("teamId", cfg.teamId);
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function call(cfg: VercelConfig, f: Fetcher, method: string, path: string, opts: { query?: Record<string, string>; json?: unknown; body?: Buffer; headers?: Record<string, string> } = {}) {
  const res = await f(`${API}${path}${qs(cfg, opts.query)}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(opts.json ? { "Content-Type": "application/json" } : {}), ...opts.headers },
    body: opts.json ? JSON.stringify(opts.json) : opts.body ? new Uint8Array(opts.body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  return res;
}

/** Mensagem curta para a pessoa: nunca repassa o corpo da resposta (pode conter detalhes da conta). */
function explain(status: number, code: string | null, step: string): VercelError {
  const why = status === 401 || status === 403 ? "o token foi recusado ou não tem permissão (confira VERCEL_TOKEN e, para conta de equipe, VERCEL_TEAM_ID)"
    : status === 402 ? "o plano da Vercel não permite esta ação"
    : status === 429 ? "limite de uso da Vercel atingido; tente de novo em alguns minutos"
    : status === 409 ? "já existe um projeto com esse nome na sua conta da Vercel"
    : status >= 500 ? "a Vercel está com instabilidade; tente de novo"
    : `a Vercel recusou o pedido (HTTP ${status}${code ? `, ${code}` : ""})`;
  return new VercelError(`Vercel, ao ${step}: ${why}.`, status, code);
}

async function errCode(res: Response): Promise<string | null> {
  try { return ((await res.json()) as { error?: { code?: string } }).error?.code ?? null; } catch { return null; }
}

export const projectNameFor = (cfg: VercelConfig, slug: string, salt = "") =>
  `${cfg.prefix}-${slug}${salt ? `-${salt}` : ""}`.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** Escolhe o projeto do site: reaproveita o já registrado; no primeiro envio, evita sobrescrever um projeto alheio de mesmo nome. */
export async function pickProject(cfg: VercelConfig, slug: string, known: string | null, f: Fetcher = fetch): Promise<string> {
  if (known) return known;
  for (let i = 0; i < 4; i++) {
    const name = projectNameFor(cfg, slug, i ? createHash("sha1").update(`${slug}${i}${Date.now()}`).digest("hex").slice(0, 4) : "");
    const r = await call(cfg, f, "GET", `/v9/projects/${encodeURIComponent(name)}`);
    if (r.status === 404) return name;
    if (!r.ok) throw explain(r.status, await errCode(r), "verificar o nome do projeto");
  }
  throw new VercelError("Vercel: não foi possível achar um nome de projeto livre.", 409);
}

const VERCEL_JSON = JSON.stringify({ cleanUrls: true, headers: [{ source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex" }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "no-referrer" }] }] });

async function uploadAll(cfg: VercelConfig, f: Fetcher, files: BundleFile[]) {
  const queue = files.map((x) => ({ x, sha: createHash("sha1").update(x.data).digest("hex") }));
  let failure: VercelError | null = null;
  const worker = async () => {
    for (let item = queue.shift(); item && !failure; item = queue.shift()) {
      const r = await call(cfg, f, "POST", "/v2/files", { body: item.x.data, headers: { "x-vercel-digest": item.sha, "Content-Type": "application/octet-stream", "Content-Length": String(item.x.data.length) } });
      if (!r.ok && r.status !== 409) failure = explain(r.status, await errCode(r), `enviar ${item.x.path}`);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (failure) throw failure;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type VercelDeploy = { url: string; project: string; deploymentId: string; verified: boolean; verifiedStatus: number | null };

/** Envia a prévia (nova ou atualização) e devolve a URL pública estável, já verificada. */
export async function deployPreview(content: SiteContent, slug: string, known: string | null, deps: { cfg?: VercelConfig | null; f?: Fetcher; wait?: (ms: number) => Promise<void> } = {}): Promise<VercelDeploy | null> {
  const base = deps.cfg === undefined ? vercelConfig() : deps.cfg;
  if (!base) return null;
  const f = deps.f ?? fetch, wait = deps.wait ?? sleep;
  const cfg = await withTeam(base, f);
  const project = await pickProject(cfg, slug, known, f);
  const bundle = await buildRootBundle(content);
  bundle.push({ path: "vercel.json", data: Buffer.from(VERCEL_JSON) });
  await uploadAll(cfg, f, bundle);

  const created = await call(cfg, f, "POST", "/v13/deployments", {
    query: { skipAutoDetectionConfirmation: "1", forceNew: "1" },
    json: { name: project, project, target: "production", projectSettings: { framework: null, buildCommand: null, outputDirectory: null }, files: bundle.map((x) => ({ file: x.path, sha: createHash("sha1").update(x.data).digest("hex"), size: x.data.length })) },
  });
  if (!created.ok) throw explain(created.status, await errCode(created), "criar o deploy");
  let dep = (await created.json()) as { id: string; url?: string; readyState?: string; alias?: string[] };

  for (let i = 0; i < 45 && dep.readyState !== "READY"; i++) {
    if (dep.readyState === "ERROR" || dep.readyState === "CANCELED") throw new VercelError("Vercel: o deploy da prévia falhou. Tente publicar de novo.", 502, dep.readyState);
    await wait(2000);
    const r = await call(cfg, f, "GET", `/v13/deployments/${encodeURIComponent(dep.id)}`);
    if (!r.ok) throw explain(r.status, await errCode(r), "acompanhar o deploy");
    dep = (await r.json()) as typeof dep;
  }
  if (dep.readyState !== "READY") throw new VercelError("Vercel: o deploy demorou demais. Tente de novo em instantes.", 504, "TIMEOUT");

  // Torna a prévia aberta a quem recebe o link (sem login da Vercel). Se o plano não permitir, o aviso fica no log.
  const pr = await call(cfg, f, "PATCH", `/v9/projects/${encodeURIComponent(project)}`, { json: { ssoProtection: null } });
  if (!pr.ok) log("warn", "vercel_protection_not_disabled", { status: pr.status });

  // URL estável do projeto: o domínio curto <projeto>.vercel.app (domínios do projeto + aliases do deploy; o mais curto vence).
  const dr = await call(cfg, f, "GET", `/v9/projects/${encodeURIComponent(project)}/domains`);
  const domains = dr.ok ? ((await dr.json()) as { domains?: { name: string }[] }).domains?.map((d) => d.name) ?? [] : [];
  const pick = [...domains, ...(dep.alias ?? [])].filter((a) => /\.vercel\.app$/.test(a)).sort((a, b) => a.length - b.length)[0];
  const url = `https://${pick ?? `${project}.vercel.app`}`;
  const v = await verifyPublicUrl(url, { f, wait });
  return { url, project, deploymentId: dep.id, verified: v.ok, verifiedStatus: v.status };
}

/** O servidor abre a URL pela internet e confere que é a prévia (HTTP 200 e uma página HTML). */
export async function verifyPublicUrl(url: string, deps: { f?: Fetcher; wait?: (ms: number) => Promise<void>; tries?: number } = {}): Promise<{ ok: boolean; status: number | null }> {
  const f = deps.f ?? fetch, wait = deps.wait ?? sleep;
  let status: number | null = null;
  for (let i = 0; i < (deps.tries ?? 6); i++) {
    try {
      const r = await f(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "SiteHunterAI-verify/1.0" } });
      status = r.status;
      if (r.ok && /<title/i.test((await r.text()).slice(0, 4000))) return { ok: true, status };
    } catch { status = null; }
    await wait(2500);
  }
  return { ok: false, status };
}

/** Apaga o projeto do site na Vercel (a URL deixa de abrir). */
export async function removePreview(project: string, deps: { cfg?: VercelConfig | null; f?: Fetcher } = {}): Promise<void> {
  const base = deps.cfg === undefined ? vercelConfig() : deps.cfg;
  if (!base) return;
  const f = deps.f ?? fetch;
  const cfg = await withTeam(base, f);
  const r = await call(cfg, f, "DELETE", `/v9/projects/${encodeURIComponent(project)}`);
  if (!r.ok && r.status !== 404) log("warn", "vercel_remove_failed", { status: r.status });
}
