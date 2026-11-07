import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { cleanDb, makeUser } from "./helpers";
import { runLeadSearch } from "@/lib/leads/pipeline";
import { csvToRows } from "@/lib/leads/providers/csvImport";
import type { Facts } from "@/lib/leads/types";

const crit = { niche: "barbearia", location: "Curitiba, PR", language: "pt-BR" as const, count: 6 };

beforeEach(cleanDb);
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_PLACES_API_KEY;
});

describe("Pipeline de leads", () => {
  it("modo demonstração cria leads fictícios marcados e não duplica na segunda busca", async () => {
    const u = await makeUser("a@test.dev");
    const r1 = await runLeadSearch({ userId: u.id, criteria: crit, providerId: "demo" });
    expect(r1.search.status).toBe("DONE");
    expect(r1.createdIds).toHaveLength(6);
    const leads = await prisma.company.findMany({ where: { userId: u.id } });
    expect(leads.every((l) => l.isDemo && l.source === "demo")).toBe(true);
    expect(leads.every((l) => (l.facts as Facts).name?.note?.includes("fictício"))).toBe(true);
    expect(leads.some((l) => l.opportunityScore > 0)).toBe(true);

    const r2 = await runLeadSearch({ userId: u.id, criteria: crit, providerId: "demo" });
    expect(r2.createdIds).toHaveLength(0);
    expect(r2.search.duplicates).toBe(6);
  });

  it("dados demo nunca são deduplicados contra leads reais (e vice-versa)", async () => {
    const u = await makeUser("b@test.dev");
    const [demo] = await (await import("@/lib/leads/providers/demo")).demoProvider.search({ ...crit, count: 1 });
    await prisma.company.create({ data: { userId: u.id, source: "google_places", sourceId: "real-1", name: demo!.name, city: demo!.city, dedupeKeys: [`name:${demo!.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|curitiba`] } });
    const r = await runLeadSearch({ userId: u.id, criteria: { ...crit, count: 1 }, providerId: "demo" });
    expect(r.createdIds).toHaveLength(1);
  });

  it("busca real (Google Places simulado) registra fontes e respeita a quantidade", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "chave-de-teste";
    const places = Array.from({ length: 5 }, (_, i) => ({
      id: `pl${i}`, displayName: { text: `Barbearia ${i}` }, formattedAddress: `Rua ${i}, Curitiba`, nationalPhoneNumber: `(41) 3000-000${i}`,
      websiteUri: i === 0 ? "https://instagram.com/barb0" : undefined, googleMapsUri: `https://maps.google.com/?cid=${i}`, primaryTypeDisplayName: { text: "Barbearia" }, businessStatus: "OPERATIONAL",
    }));
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain("places:searchText");
      const body = JSON.parse(String(init?.body));
      expect(body.textQuery).toBe("barbearia em Curitiba - PR");
      expect(body.locationBias).toBeTruthy();
      return new Response(JSON.stringify({ places: places.slice(0, body.pageSize) }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const u = await makeUser("c@test.dev");
    const r = await runLeadSearch({ userId: u.id, criteria: { ...crit, count: 3 }, providerId: "google_places" });
    // WhatsApp não é requisito: as empresas entram com o telefone publicado, até a quantidade pedida.
    expect(r.createdIds).toHaveLength(3);
    expect(r.search.found).toBe(5);
    const log = r.search.log as { step: string; detail?: string }[];
    expect(log.find((x) => x.step === "contacts")?.detail).toMatch(/3 salvas · 0 com WhatsApp confirmado · 3 com telefone \(WhatsApp não informado\)/);
    expect(log.find((x) => x.step === "coverage")?.detail).toMatch(/3 entraram na lista: 0 com WhatsApp confirmado, 3 com telefone \(WhatsApp não informado\)/);
    const saved = await prisma.company.findMany({ where: { userId: u.id } });
    expect(saved.every((c) => c.whatsapp === null && !!c.phone)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // perfis sociais/sem site: nenhum site acessado
  });

  it("todas as empresas entram; WhatsApp só é marcado quando confirmado em fonte pública", async () => {
    const items = [
      { osm_type: "node", osm_id: 1, lat: "-25.43", lon: "-49.27", name: "Barbearia Zap", category: "shop", type: "hairdresser", address: { road: "Rua A", city: "Curitiba", state: "Paraná" }, extratags: { "contact:whatsapp": "+55 41 99876-5432", phone: "+55 41 3333-0000" } },
      { osm_type: "node", osm_id: 2, lat: "-25.43", lon: "-49.27", name: "Barbearia Fixo", category: "shop", type: "hairdresser", address: { road: "Rua B", city: "Curitiba", state: "Paraná" }, extratags: { phone: "+55 41 3333-1111" } },
      { osm_type: "node", osm_id: 3, lat: "-25.43", lon: "-49.27", name: "Barbearia Celular", category: "shop", type: "hairdresser", address: { road: "Rua C", city: "Curitiba", state: "Paraná" }, extratags: { phone: "+55 41 99111-2222" } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(items))));
    const u = await makeUser("wa@test.dev");
    const r = await runLeadSearch({ userId: u.id, criteria: { niche: "barbearia", location: "Curitiba - PR", cityIbge: 4106902, language: "pt-BR", count: 5 }, providerId: "osm" });
    expect(r.createdIds).toHaveLength(3);
    const all = await prisma.company.findMany({ where: { userId: u.id } });
    const l = all.find((c) => c.name === "Barbearia Zap")!;
    expect(l.whatsapp).toBe("5541998765432");
    expect((l.facts as Facts).whatsapp).toMatchObject({ status: "confirmed", source: "OpenStreetMap" });
    // celular sem indicação de WhatsApp não vira WhatsApp: fica como telefone
    expect(all.find((c) => c.name === "Barbearia Celular")).toMatchObject({ whatsapp: null, phone: "+55 41 99111-2222" });
    expect(all.find((c) => c.name === "Barbearia Fixo")?.whatsapp).toBeNull();
  });

  it("falha do provedor marca a busca como FAILED", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "x";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    const u = await makeUser("d@test.dev");
    await expect(runLeadSearch({ userId: u.id, criteria: crit, providerId: "google_places" })).rejects.toThrow();
    expect((await prisma.leadSearch.findFirstOrThrow({ where: { userId: u.id } })).status).toBe("FAILED");
  });

  it("importação CSV registra o usuário como fonte e isola por conta", async () => {
    const u = await makeUser("e@test.dev");
    const other = await makeUser("f@test.dev");
    const rows = csvToRows("nome,cidade,telefone\nPadaria Sol,Recife,(81) 3333-0000\nPadaria Sol,Recife,(81) 3333-0000\n");
    const r = await runLeadSearch({ userId: u.id, criteria: { ...crit, count: 2 }, providerId: "import", rows });
    expect(r.search.duplicates).toBe(1);
    // Telefone fixo informado na planilha não conta como WhatsApp, mas a empresa entra com o telefone.
    expect(r.createdIds).toHaveLength(1);
    expect((await prisma.company.findFirstOrThrow({ where: { userId: u.id } })).whatsapp).toBeNull();
    expect(await prisma.company.count({ where: { userId: other.id } })).toBe(0);
  });
});
