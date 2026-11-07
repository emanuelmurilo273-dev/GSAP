import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { cleanDb, makeUser } from "./helpers";
import { sha256 } from "@/lib/crypto";

let token = "";
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "sh_session" && token ? { value: token } : undefined), set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));

async function login(userId: string) {
  token = `sessao-${userId}-${Date.now()}`;
  await prisma.session.create({ data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600e3) } });
}

describe("Barreira de administrador (sessão real no banco de teste)", () => {
  beforeEach(async () => { await cleanDb(); token = ""; process.env.ACCESS_MODE = "saas"; });
  afterEach(() => { delete process.env.ACCESS_MODE; });

  it("assinante comum recebe 403 em todas as rotas administrativas novas; administrador passa", async () => {
    const sub = await makeUser("assinante@exemplo.dev", { premiumUntil: new Date(Date.now() + 86400e3) });
    const adm = await makeUser("admin@exemplo.dev", { role: "ADMIN" });
    const company = await prisma.company.create({ data: { userId: adm.id, source: "osm", sourceId: "node/1", name: "Autopeças Teste", category: "Autopeças", city: "Curitiba", state: "PR", phone: "5541999990000" } });
    const origin = "http://localhost:3000";
    const patchReq = () => new Request(`${origin}/api/admin/companies/${company.id}`, { method: "PATCH", headers: { origin, host: "localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ contacted: true }) });
    const { PATCH } = await import("@/app/api/admin/companies/[id]/route");
    const exp = await import("@/app/api/admin/companies/export/route");
    const ctx = { params: Promise.resolve({ id: company.id }) };

    await login(sub.id);
    expect((await PATCH(patchReq(), ctx)).status).toBe(403);
    expect((await exp.GET(new Request(`${origin}/api/admin/companies/export`), { params: Promise.resolve({}) })).status).toBe(403);
    expect((await prisma.company.findUniqueOrThrow({ where: { id: company.id } })).contactedAt).toBeNull();

    await login(adm.id);
    expect((await PATCH(patchReq(), ctx)).status).toBe(200);
    expect((await prisma.company.findUniqueOrThrow({ where: { id: company.id } })).contactedAt).not.toBeNull();
    const csv = await (await exp.GET(new Request(`${origin}/api/admin/companies/export?cat=Autope%C3%A7as`), { params: Promise.resolve({}) })).text();
    expect(csv).toContain("Autopeças Teste");
    expect(csv).toContain("(41) 99999-0000");
    const log = await prisma.auditLog.findFirst({ where: { action: "admin_company_updated" } });
    expect(log?.actorId).toBe(adm.id);
  });

  it("modo privado: só o administrador proprietário tem sessão; assinante é tratado como visitante (401)", async () => {
    delete process.env.ACCESS_MODE;
    const sub = await makeUser("assinante3@exemplo.dev");
    const adm = await makeUser("admin3@exemplo.dev", { role: "ADMIN" });
    const exp = await import("@/app/api/admin/companies/export/route");
    const req = () => new Request("http://localhost:3000/api/admin/companies/export");
    await login(sub.id);
    expect((await exp.GET(req(), { params: Promise.resolve({}) })).status).toBe(401);
    await login(adm.id);
    expect((await exp.GET(req(), { params: Promise.resolve({}) })).status).toBe(200);
  });

  it("padrões de busca: só administrador altera e valores fora do limite são recusados", async () => {
    const sub = await makeUser("assinante2@exemplo.dev");
    const adm = await makeUser("admin2@exemplo.dev", { role: "ADMIN" });
    const { PUT } = await import("@/app/api/admin/settings/route");
    const origin = "http://localhost:3000";
    const body = (o: object) => new Request(`${origin}/api/admin/settings`, { method: "PUT", headers: { origin, host: "localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ priceCents: 7700, checkoutUrl: null, maxSearchesPerMonth: 100, maxGenerationsPerMonth: 100, maxPublishedSites: 10, graceDays: 0, retentionDays: 30, usageWarnPercent: 80, searchDefaultCount: 12, searchDefaultProvider: "osm", searchQuickNiches: "martelinho de ouro", ...o }) });
    const ctx = { params: Promise.resolve({}) };
    await login(sub.id);
    expect((await PUT(body({}), ctx)).status).toBe(403);
    await login(adm.id);
    expect((await PUT(body({ searchDefaultCount: 99 }), ctx)).status).toBe(400);
    expect((await PUT(body({ searchQuickNiches: "<script>" }), ctx)).status).toBe(400);
    expect((await PUT(body({}), ctx)).status).toBe(200);
    const s = await prisma.platformSettings.findUniqueOrThrow({ where: { id: "global" } });
    expect(s.searchDefaultCount).toBe(12);
    expect(s.searchQuickNiches).toBe("martelinho de ouro");
  });
});
