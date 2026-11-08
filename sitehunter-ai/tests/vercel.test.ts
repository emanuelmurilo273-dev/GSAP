import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { cleanDb, makeUser } from "./helpers";
import { VercelError, deployPreview, pickProject, projectNameFor, removePreview, vercelConfig, verifyPublicUrl } from "@/lib/vercel";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { publishProject, shareUrlFor, unpublishProject } from "@/lib/publish";

const TOKEN = "vcp_TOKEN_SECRETO_DE_TESTE";
const cfg = { token: TOKEN, teamId: "team_abc123", prefix: "hunter" };
const co: CompanyInfo = { name: "Zé Pneus", category: "Pneus e borracharia", address: "Av. Sertório, 6000", neighborhood: "São Sebastião", city: "Porto Alegre", state: "RS", phone: "(51) 3500-0528", website: null, mapsUrl: null } as CompanyInfo;
const content = () => { const s = getSegment("pneus"); return buildSiteContent(co, s, fallbackCopy(co, s), []); };

type Call = { method: string; url: URL; headers: Record<string, string>; body?: unknown; raw?: BodyInit | null };
function fakeVercel(opts: { projectExists?: boolean; deployStatus?: number; verifyStatus?: number; readyAfter?: number; protectionStatus?: number } = {}) {
  const calls: Call[] = []; const uploaded = new Set<string>(); let polls = 0;
  const f = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input)); const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method ?? "GET", url, headers, body, raw: init.body });
    const j = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (url.hostname !== "api.vercel.com") return new Response(opts.verifyStatus && opts.verifyStatus !== 200 ? "erro" : "<!doctype html><title>Zé Pneus</title>", { status: opts.verifyStatus ?? 200 });
    const p = url.pathname, m = init.method ?? "GET";
    if (m === "GET" && p.endsWith("/domains")) return j({ domains: [{ name: "hunter-ze-pneus.vercel.app" }] });
    if (m === "GET" && p.startsWith("/v9/projects/")) return opts.projectExists ? j({ id: "prj_x" }) : j({ error: { code: "not_found" } }, 404);
    if (m === "POST" && p === "/v2/files") { uploaded.add(headers["x-vercel-digest"]!); return j({}); }
    if (m === "POST" && p === "/v13/deployments") return (opts.deployStatus ?? 200) === 200 ? j({ id: "dpl_1", url: "hunter-ze-x1-team.vercel.app", readyState: "QUEUED" }) : j({ error: { code: "forbidden", message: `token ${TOKEN} sem permissão` } }, opts.deployStatus);
    if (m === "GET" && p === "/v13/deployments/dpl_1") { polls++; return j(polls > (opts.readyAfter ?? 1) ? { id: "dpl_1", readyState: "READY", alias: ["hunter-ze-pneus-sertorio-6000-team-abc.vercel.app", "hunter-ze-pneus.vercel.app"] } : { id: "dpl_1", readyState: "BUILDING" }); }
    if (m === "PATCH" && p.startsWith("/v9/projects/")) return j({}, opts.protectionStatus ?? 200);
    if (m === "DELETE" && p.startsWith("/v9/projects/")) return j({}, 200);
    return j({ error: { code: "inesperado" } }, 500);
  }) as typeof fetch;
  return { f, calls, uploaded };
}
const noWait = async () => undefined;

describe("Publicação de prévias na Vercel (API oficial simulada)", () => {
  it("configuração: sem token fica desligada; com token lê equipe e prefixo", () => {
    delete process.env.VERCEL_TOKEN; delete process.env.VERCEL_TEAM_ID;
    expect(vercelConfig()).toBeNull();
    process.env.VERCEL_TOKEN = TOKEN; process.env.VERCEL_TEAM_ID = "team_abc123"; process.env.VERCEL_PROJECT_PREFIX = "Meu Hunter!";
    expect(vercelConfig()).toEqual({ token: TOKEN, teamId: "team_abc123", prefix: "meuhunter" });
    process.env.VERCEL_TEAM_ID = "inválido!!"; expect(vercelConfig()!.teamId).toBeNull();
    delete process.env.VERCEL_TOKEN; delete process.env.VERCEL_TEAM_ID; delete process.env.VERCEL_PROJECT_PREFIX;
  });

  it("primeiro envio: sobe os arquivos por hash, cria o deploy de produção e devolve a URL estável já verificada", async () => {
    const v = fakeVercel();
    const r = (await deployPreview(content(), "ze-pneus", null, { cfg, f: v.f, wait: noWait }))!;
    expect(r.url).toBe("https://hunter-ze-pneus.vercel.app"); // alias mais curto (o do projeto), não o do deploy
    expect(r).toMatchObject({ project: "hunter-ze-pneus", deploymentId: "dpl_1", verified: true, verifiedStatus: 200 });
    const dep = v.calls.find((c) => c.method === "POST" && c.url.pathname === "/v13/deployments")!;
    expect(dep.url.searchParams.get("teamId")).toBe("team_abc123");
    const b = dep.body as { name: string; target: string; files: { file: string; sha: string; size: number }[]; projectSettings: { framework: null } };
    expect(b.target).toBe("production");
    expect(b.name).toBe("hunter-ze-pneus");
    expect(b.files.map((x) => x.file)).toEqual(expect.arrayContaining(["index.html", "vercel.json"]));
    expect(b.files.every((x) => !x.file.startsWith("/") && !x.file.includes(".."))).toBe(true);
    for (const x of b.files) expect(v.uploaded.has(x.sha), x.file).toBe(true); // todo arquivo do deploy foi enviado antes
    expect(JSON.stringify(b)).not.toContain(TOKEN);
    expect(v.calls.some((c) => c.method === "PATCH")).toBe(true); // abre a prévia sem login da Vercel
  });

  it("o token só vai para api.vercel.com, nunca para a URL pública da prévia", async () => {
    const v = fakeVercel();
    await deployPreview(content(), "ze-pneus", null, { cfg, f: v.f, wait: noWait });
    for (const c of v.calls) {
      if (c.url.hostname === "api.vercel.com") expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      else { expect(JSON.stringify(c.headers)).not.toContain(TOKEN); expect(c.url.href).not.toContain(TOKEN); }
    }
    expect(v.calls.some((c) => c.url.hostname === "hunter-ze-pneus.vercel.app")).toBe(true);
  });

  it("atualizar: reaproveita o projeto (mesma URL) e não confere nome de novo", async () => {
    const v = fakeVercel({ projectExists: true });
    const r = (await deployPreview(content(), "ze-pneus", "hunter-ze-pneus", { cfg, f: v.f, wait: noWait }))!;
    expect(r.url).toBe("https://hunter-ze-pneus.vercel.app");
    expect(v.calls.filter((c) => c.method === "GET" && c.url.pathname.startsWith("/v9/projects/") && !c.url.pathname.endsWith("/domains"))).toHaveLength(0);
  });

  it("nome de projeto: evita sobrescrever um projeto alheio de mesmo nome", async () => {
    const v = fakeVercel({ projectExists: true });
    // todos os nomes "existem": desiste com erro claro em vez de sobrescrever
    await expect(pickProject(cfg, "ze-pneus", null, v.f)).rejects.toMatchObject({ status: 409 });
    expect(projectNameFor(cfg, "ze-pneus", "ab12")).toBe("hunter-ze-pneus-ab12");
    expect(projectNameFor(cfg, "A  B--c")).toBe("hunter-a-b-c");
    expect(projectNameFor(cfg, "x".repeat(100)).length).toBeLessThanOrEqual(60);
  });

  it("erros viram mensagem curta em português, sem repassar o corpo da resposta (onde poderia vir o token)", async () => {
    const v = fakeVercel({ deployStatus: 403 });
    const e = await deployPreview(content(), "ze-pneus", null, { cfg, f: v.f, wait: noWait }).catch((x) => x as VercelError);
    expect(e).toBeInstanceOf(VercelError);
    expect((e as VercelError).message).toMatch(/token foi recusado/);
    expect((e as VercelError).message).not.toContain(TOKEN);
  });

  it("verificação: URL que não abre fica como não verificada (sem mentir)", async () => {
    expect(await verifyPublicUrl("https://x.vercel.app", { f: fakeVercel({ verifyStatus: 404 }).f, wait: noWait, tries: 3 })).toEqual({ ok: false, status: 404 });
    expect((await verifyPublicUrl("https://x.vercel.app", { f: fakeVercel().f, wait: noWait })).ok).toBe(true);
    const r = (await deployPreview(content(), "ze-pneus", null, { cfg, f: fakeVercel({ verifyStatus: 404 }).f, wait: noWait }))!;
    expect(r.verified).toBe(false);
  });

  it("remover: apaga o projeto e aceita 'já não existe'", async () => {
    const v = fakeVercel();
    await removePreview("hunter-ze-pneus", { cfg, f: v.f });
    expect(v.calls.at(-1)).toMatchObject({ method: "DELETE" });
    expect(v.calls.at(-1)!.url.pathname).toBe("/v9/projects/hunter-ze-pneus");
  });
});

describe("Publicar e despublicar pelo fluxo do Hunter com a Vercel", () => {
  let v: ReturnType<typeof fakeVercel>;
  beforeEach(async () => {
    await cleanDb(); v = fakeVercel();
    process.env.VERCEL_TOKEN = TOKEN; process.env.VERCEL_TEAM_ID = "team_abc123";
    vi.stubGlobal("fetch", (u: RequestInfo | URL, i?: RequestInit) => v.f(u, i));
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.VERCEL_TOKEN; delete process.env.VERCEL_TEAM_ID; });

  it("cada site recebe uma URL compartilhável; atualizar mantém a URL; despublicar apaga o projeto", async () => {
    const u = await makeUser("dono@exemplo.dev", { premiumUntil: new Date(Date.now() + 86400e3) });
    const project = await prisma.project.create({ data: { userId: u.id, name: "Zé Pneus", segment: "pneus", content: content() as never } });
    const pub = await publishProject(project, u.id, "ze-pneus");
    expect(pub).toMatchObject({ externalProvider: "vercel", vercelProject: expect.stringMatching(/^hunter-ze-pneus/) });
    expect(pub.externalUrl).toMatch(/^https:\/\/hunter-ze-pneus.*\.vercel\.app$/);
    expect(pub.externalVerifiedAt).not.toBeNull();
    expect(shareUrlFor(pub)).toBe(pub.externalUrl); // é este o link que entra nas abordagens
    const again = await publishProject(project, u.id);
    expect(again.externalUrl).toBe(pub.externalUrl);
    expect(again.vercelProject).toBe(pub.vercelProject);
    expect(v.calls.filter((c) => c.method === "POST" && c.url.pathname === "/v13/deployments")).toHaveLength(2);
    await unpublishProject(project.id, u.id);
    const gone = await prisma.publication.findUniqueOrThrow({ where: { projectId: project.id } });
    expect(gone).toMatchObject({ status: "UNPUBLISHED", externalUrl: null, externalProvider: null, vercelProject: null }); // projeto apagado: o próximo envio cria um novo, sem herdar o nome
    expect(v.calls.some((c) => c.method === "DELETE" && c.url.pathname === `/v9/projects/${pub.vercelProject}`)).toBe(true);
  });

  it("se a Vercel recusar, o site continua no app e a pessoa recebe o motivo em português", async () => {
    v = fakeVercel({ deployStatus: 403 });
    const u = await makeUser("dono2@exemplo.dev", { premiumUntil: new Date(Date.now() + 86400e3) });
    const project = await prisma.project.create({ data: { userId: u.id, name: "Zé Pneus", segment: "pneus", content: content() as never } });
    await expect(publishProject(project, u.id, "ze-pneus")).rejects.toMatchObject({ status: 502, message: expect.stringContaining("token foi recusado") });
    const pub = await prisma.publication.findUniqueOrThrow({ where: { projectId: project.id } });
    expect(pub.status).toBe("PUBLISHED");
    expect(pub.externalUrl).toBeNull();
  });
});
