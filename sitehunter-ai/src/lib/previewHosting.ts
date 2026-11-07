import { env } from "./env";
import { log } from "./logger";
import { buildPreviewBundle, type BundleFile } from "./previewBundle";
import type { SiteContent } from "./site/types";

// Link público das prévias, sem depender do computador do usuário: os arquivos vão para um
// repositório PÚBLICO no GitHub do usuário (API de conteúdo, token só no servidor) e o link é:
//   GitHub Pages (https://<usuario>.github.io/<repo>/..., ou GITHUB_PAGES_URL para domínio próprio).
// O Pages precisa ser ativado uma vez no repositório (Settings → Pages). CDNs de arquivos "raw"
// (githack, jsDelivr, statically) foram testadas e não servem: entregam text/plain ou uma página de anúncio.
// Só a página da prévia e os recursos 3D (licenças MIT/CC0) saem do app; o painel e os leads não.

export type HostingConfig = { token: string; owner: string; repo: string; branch: string; dir: string; pagesUrl: string | null };

export function hostingConfig(): HostingConfig | null {
  const token = env.githubPreviewsToken, full = env.githubPreviewsRepo;
  if (!token || !full || !/^[\w.-]+\/[\w.-]+$/.test(full)) return null;
  const [owner, repo] = full.split("/") as [string, string];
  return { token, owner, repo, branch: env.githubPreviewsBranch ?? "main", dir: env.githubPreviewsDir ?? "previas", pagesUrl: env.githubPagesUrl ?? null };
}

/** Endereço padrão do GitHub Pages do repositório (repo "<usuario>.github.io" publica na raiz). */
export function pagesBaseFor(cfg: Pick<HostingConfig, "owner" | "repo" | "pagesUrl">) {
  if (cfg.pagesUrl) return cfg.pagesUrl.replace(/\/$/, "");
  const user = cfg.owner.toLowerCase();
  return cfg.repo.toLowerCase() === `${user}.github.io` ? `https://${user}.github.io` : `https://${user}.github.io/${cfg.repo}`;
}

export function externalUrlFor(cfg: HostingConfig, slug: string) {
  return `${pagesBaseFor(cfg)}/${cfg.dir}/${slug}/`;
}

async function gh(cfg: HostingConfig, method: string, p: string, body?: unknown) {
  const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${p.split("/").map(encodeURIComponent).join("/")}${method === "GET" ? `?ref=${encodeURIComponent(cfg.branch)}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "SiteHunterAI" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  return r;
}

async function shaOf(cfg: HostingConfig, p: string): Promise<string | null> {
  const r = await gh(cfg, "GET", p);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} ao ler ${p}`);
  return ((await r.json()) as { sha?: string }).sha ?? null;
}

async function put(cfg: HostingConfig, f: BundleFile, message: string, overwrite: boolean) {
  const sha = await shaOf(cfg, f.path);
  if (sha && !overwrite) return; // recursos compartilhados já enviados
  const r = await gh(cfg, "PUT", f.path, { message, content: f.data.toString("base64"), branch: cfg.branch, ...(sha ? { sha } : {}) });
  if (!r.ok) throw new Error(`GitHub ${r.status} ao enviar ${f.path}: ${(await r.text()).slice(0, 160)}`);
}

/** Envia (ou atualiza) a prévia e devolve o link público. */
export async function publishExternal(content: SiteContent, slug: string, cfg = hostingConfig()): Promise<string | null> {
  if (!cfg) return null;
  const files = await buildPreviewBundle(content, slug, cfg.dir);
  // Sem isto o Jekyll do Pages ignora pastas que começam com "_" (os recursos 3D em _assets).
  files.unshift({ path: ".nojekyll", data: Buffer.from("") } as BundleFile);
  for (const f of files) await put(cfg, f, `Prévia ${slug}: ${f.path.endsWith("index.html") ? "atualiza página" : "recurso 3D"}`, f.path.endsWith("index.html"));
  return externalUrlFor(cfg, slug);
}

/** Retira a página do ar (os recursos compartilhados ficam). O histórico do Git guarda versões antigas. */
export async function unpublishExternal(slug: string, cfg = hostingConfig()): Promise<void> {
  if (!cfg) return;
  const p = `${cfg.dir}/${slug}/index.html`;
  const sha = await shaOf(cfg, p).catch(() => null);
  if (!sha) return;
  const r = await gh(cfg, "DELETE", p, { message: `Prévia ${slug}: acesso retirado`, sha, branch: cfg.branch });
  if (!r.ok) log("warn", "external_unpublish_failed", { status: r.status });
}
