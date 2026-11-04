import type { HoursLine } from "./types";

// Normaliza horários publicados em linhas legíveis ("Segunda a sexta" → "09:00–18:00").
// Fontes: tag opening_hours do OpenStreetMap e weekdayDescriptions do Google Places.
// Se o formato não for reconhecido, o texto original é mantido em uma linha (nada é inventado).

const DAYS: Record<string, string> = { Mo: "Segunda", Tu: "Terça", We: "Quarta", Th: "Quinta", Fr: "Sexta", Sa: "Sábado", Su: "Domingo", PH: "Feriados" };
const ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su", "PH"];

function dayLabel(spec: string): string | null {
  const parts = spec.split(",").map((p) => p.trim());
  const out: string[] = [];
  for (const p of parts) {
    const m = p.match(/^(Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    if (m[2]) {
      const a = DAYS[m[1]!]!, b = DAYS[m[2]]!;
      out.push(ORDER.indexOf(m[2]) - ORDER.indexOf(m[1]!) === 1 ? `${a} e ${b.toLowerCase()}` : `${a} a ${b.toLowerCase()}`);
    } else out.push(DAYS[m[1]!]!);
  }
  return out.join(", ").replace(/^(.)/, (c) => c.toUpperCase());
}

/** Formato não reconhecido: mantém o conteúdo, só traduz os dias abreviados e os traços de horário. */
function translateDays(v: string) {
  const PT: Record<string, string> = { Mo: "seg", Tu: "ter", We: "qua", Th: "qui", Fr: "sex", Sa: "sáb", Su: "dom", PH: "feriados" };
  return v.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => PT[d]!).replace(/(\d)-(\d)/g, "$1–$2").replace(/\boff\b/g, "fechado");
}

/** opening_hours do OSM (casos comuns: "Mo-Fr 09:00-18:00; Sa 09:00-13:00", "24/7", "off"). */
export function parseOsmHours(raw: string | null | undefined): HoursLine[] | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v === "24/7") return [{ label: "Todos os dias", value: "24 horas" }];
  const lines: HoursLine[] = [];
  for (const rule of v.split(";").map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^([A-Za-z,\- ]+?)\s+(off|closed|(?:\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*))$/);
    const label = m ? dayLabel(m[1]!.replace(/\s+/g, "")) : null;
    if (!m || !label) return [{ label: "Horário", value: translateDays(v).slice(0, 80) }];
    const value = /off|closed/.test(m[2]!) ? "Fechado" : m[2]!.replace(/-/g, "–").replace(/\s*,\s*/g, " e ");
    lines.push({ label, value });
  }
  return lines.length ? lines.slice(0, 10) : null;
}

/** weekdayDescriptions do Google Places ("segunda-feira: 09:00–19:00"). Agrupa dias iguais consecutivos. */
export function parseGoogleHours(desc: string[] | null | undefined): HoursLine[] | null {
  if (!desc?.length) return null;
  const rows = desc.map((d) => {
    const i = d.indexOf(":");
    const day = (i > 0 ? d.slice(0, i) : d).trim();
    return { day: day.charAt(0).toUpperCase() + day.slice(1).replace(/-feira$/i, ""), value: (i > 0 ? d.slice(i + 1) : "").trim().replace(/^Closed$/i, "Fechado").replace(/^Fechado$/i, "Fechado") };
  });
  const out: HoursLine[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1]!.value === rows[i]!.value) j++;
    out.push({ label: j > i ? `${rows[i]!.day} a ${rows[j]!.day.toLowerCase()}` : rows[i]!.day, value: rows[i]!.value || "—" });
    i = j + 1;
  }
  return out.slice(0, 10);
}
