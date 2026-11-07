import { describe, expect, it } from "vitest";
import { parseDays, parseSchedule, parseTimes, statusAt, statusText, timezoneFor, timezoneFromAddress } from "@/lib/site/openHours";
import { buildSiteContent, fallbackCopy, getSegment, type CompanyInfo } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";

const at = (lines: { label: string; value: string }[], iso: string, tz = "America/Sao_Paulo") => statusText(statusAt(parseSchedule(lines), lines.some((l) => l.value.trim()), new Date(iso), tz));

describe("Aberto ou fechado (horário local da empresa)", () => {
  it("lê dias e intervalos publicados (OSM, Google, editor)", () => {
    expect(parseDays("Segunda a sexta")).toEqual([1, 2, 3, 4, 5]);
    expect(parseDays("Sexta a segunda")).toEqual([0, 1, 5, 6]);
    expect(parseDays("Sábado e domingo")).toEqual([0, 6]);
    expect(parseDays("Segunda a domingo, Feriados")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseTimes("09:00–12:00 e 14:00–18:00")).toEqual([[540, 720], [840, 1080]]);
    expect(parseTimes("9:00 AM – 6:00 PM")).toEqual([[540, 1080]]);
    expect(parseTimes("Fechado")).toBe("closed");
    expect(parseTimes("24 horas")).toEqual([[0, 1440]]);
  });
  it("intervalo de almoço, dia fechado e próxima abertura", () => {
    const l = [{ label: "Segunda a sexta", value: "09:00–12:00 e 14:00–18:00" }, { label: "Sábado", value: "09:00–13:00" }, { label: "Domingo", value: "Fechado" }];
    expect(at(l, "2026-11-09T13:00:00-03:00")).toBe("Fechado agora · abre às 14:00"); // segunda, almoço
    expect(at(l, "2026-11-09T10:00:00-03:00")).toBe("Aberto agora · fecha às 12:00");
    expect(at(l, "2026-11-08T10:00:00-03:00")).toBe("Fechado agora · abre amanhã às 09:00"); // domingo
    expect(at(l, "2026-11-07T19:00:00-03:00")).toBe("Fechado agora · abre segunda às 09:00"); // sábado à noite
  });
  it("aberto depois da meia-noite conta no dia seguinte", () => {
    const l = [{ label: "Sexta e sábado", value: "18:00–02:00" }];
    expect(at(l, "2026-11-07T01:30:00-03:00")).toBe("Aberto agora · fecha às 02:00"); // sábado 1h30, aberto desde sexta
    expect(at(l, "2026-11-07T23:00:00-03:00")).toBe("Aberto agora · fecha às 02:00 (amanhã)");
    expect(at(l, "2026-11-08T03:00:00-03:00")).toBe("Fechado agora · abre sexta às 18:00");
  });
  it("usa o fuso da empresa, não o do visitante nem o do servidor", () => {
    const l = [{ label: "Segunda a sexta", value: "08:00–17:00" }];
    // 17h30 em Brasília = 16h30 em Manaus: aberto em Manaus, fechado em São Paulo.
    expect(at(l, "2026-11-09T20:30:00Z", "America/Manaus")).toBe("Aberto agora · fecha às 17:00");
    expect(at(l, "2026-11-09T20:30:00Z", "America/Sao_Paulo")).toMatch(/^Fechado/);
    expect(timezoneFor("AM", "Manaus")).toBe("America/Manaus");
    expect(timezoneFor("AM", "Tabatinga")).toBe("America/Eirunepe");
    expect(timezoneFor("Acre")).toBe("America/Rio_Branco");
    expect(timezoneFromAddress("Rua A, 1 · Centro · Cuiabá · Mato Grosso")).toBe("America/Cuiaba");
  });
  it("sem dados confiáveis não presume nada", () => {
    expect(at([], "2026-11-09T12:00:00Z")).toBe("Horário não informado");
    expect(at([{ label: "Segunda a sexta", value: "" }], "2026-11-09T12:00:00Z")).toBe("Horário não informado");
    expect(at([{ label: "Horário", value: "seg–sex 9–18 (exceto feriados ponte)" }], "2026-11-09T12:00:00Z")).toBe("Confira os horários");
  });
  it("o site mostra o status, destaca o dia e atualiza no navegador; sem horário mostra 'Horário não informado'", () => {
    const base: CompanyInfo = { name: "Padaria Sol", category: "Padaria", address: "Rua A, 1 · Centro · Manaus · AM", neighborhood: "Centro", city: "Manaus", state: "AM", phone: "(92) 3333-1111", website: null, mapsUrl: null, lat: null, lng: null, hoursLines: [{ label: "Segunda a sábado", value: "06:00–20:00" }], whatsapp: "" };
    const s = getSegment("padaria");
    const c = buildSiteContent(base, s, fallbackCopy(base, s), []);
    expect((c.sections.find((x) => x.type === "hours") as { timezone?: string }).timezone).toBe("America/Manaus");
    const html = renderSite(c);
    expect(html).toContain("data-open-status");
    expect(html).toContain('data-days="1,2,3,4,5,6"');
    expect(html).toContain('"tz":"America/Manaus"');
    expect(html).toMatch(/(Aberto|Fechado) agora/);
    const none = buildSiteContent({ ...base, hoursLines: null }, s, fallbackCopy({ ...base, hoursLines: null }, s), []);
    const h2 = renderSite(none);
    expect(h2).toContain("Horário não informado");
    expect(h2).not.toContain("data-open-status");
  });
});
