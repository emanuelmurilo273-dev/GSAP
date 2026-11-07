import { describe, expect, it, vi } from "vitest";

// Sem sessão, nenhuma rota administrativa nova pode responder com sucesso.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));

describe("Rotas administrativas exigem sessão de administrador", () => {
  it("PATCH de empresa, exportação CSV e teste de fontes recusam visitante sem login", async () => {
    const { PATCH } = await import("@/app/api/admin/companies/[id]/route");
    const exp = await import("@/app/api/admin/companies/export/route");
    const health = await import("@/app/api/admin/health/route");
    const origin = "http://localhost:3000";
    const r1 = await PATCH(new Request(`${origin}/api/admin/companies/x`, { method: "PATCH", headers: { origin, host: "localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ excluded: true }) }), { params: Promise.resolve({ id: "x" }) });
    const r2 = await exp.GET(new Request(`${origin}/api/admin/companies/export`), { params: Promise.resolve({}) });
    const r3 = await health.GET(new Request(`${origin}/api/admin/health`), { params: Promise.resolve({}) });
    for (const r of [r1, r2, r3]) expect([401, 403]).toContain(r.status);
    expect(await r2.text()).not.toContain("Empresa");
  });
});
