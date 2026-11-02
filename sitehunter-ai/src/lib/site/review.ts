import type { SiteContent } from "./types";
import { safeUrl, waNumber } from "./renderer/util";

// Revisão automática antes de publicar: contatos, links, textos com cara de modelo e
// afirmações que precisam de prova. Gera avisos; não altera o conteúdo.

const CLAIMS: [RegExp, string][] = [
  [/\b\d+\s*(\+\s*)?anos\b/i, "tempo de mercado"],
  [/\b\d[\d.]*\s*(\+\s*)?(clientes|atendimentos|pacientes|alunos|pedidos)\b/i, "número de clientes/atendimentos"],
  [/\bpremiad[oa]s?\b|\bprêmios?\b/i, "prêmios"],
  [/\bcertificad[oa]s?\b|\bcertifica[çc][ãa]o\b/i, "certificações"],
  [/\bn[ºo°]\s*1\b|\bnúmero 1\b|\b(o|a|os|as) melhor(es)? (da|do|de) (cidade|região|bairro|brasil|zona)\b/i, "\"melhor\"/\"nº 1\""],
  [/\b(CRM|CRO|CREA|CRP|CREFITO|OAB)\b/, "registro profissional"],
  [/\bgarantia\b/i, "garantia"],
];
const PLACEHOLDER = /\{[a-z_]+\}|\[[^\]]{2,30}\]|lorem ipsum|xxx|\(00\)|0000-0000|seu texto|nome da empresa/i;

function texts(c: SiteContent): string[] {
  const out: string[] = [c.tagline ?? "", c.seo?.description ?? ""];
  for (const s of c.sections) {
    if (!s.visible) continue;
    const add = (...x: (string | undefined)[]) => out.push(...x.filter((v): v is string => !!v));
    if ("title" in s) add(s.title);
    switch (s.type) {
      case "hero": add(s.subtitle); break;
      case "about": case "text": case "cta": case "quote": case "contact": add(s.text); break;
      case "services": add(s.intro, ...s.items.flatMap((i) => [i.title, i.description])); break;
      case "highlights": add(...s.items.flatMap((i) => [i.title, i.text])); break;
      case "steps": add(s.intro, ...s.items.flatMap((i) => [i.title, i.text])); break;
      case "faq": add(...s.items.flatMap((i) => [i.q, i.a])); break;
      case "products": add(s.intro, ...s.items.flatMap((i) => [i.name, i.description])); break;
      case "menu": add(s.intro, ...s.categories.flatMap((cat) => cat.items.flatMap((i) => [i.name, i.description]))); break;
      default: break;
    }
  }
  return out;
}

export function reviewSite(c: SiteContent): string[] {
  const notes: string[] = [];
  const b = c.business;
  if (!b.phone && !b.whatsapp && !b.email) notes.push("Revisão: o site não tem nenhum contato. Adicione telefone, WhatsApp ou e-mail.");
  if ((b.whatsapp || b.phone) && !waNumber(b.whatsapp || b.phone)) notes.push(`Revisão: o número "${b.whatsapp || b.phone}" não parece um celular/telefone brasileiro válido com DDD; o botão de WhatsApp não vai funcionar.`);
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) notes.push(`Revisão: e-mail inválido (${b.email}).`);
  for (const [label, u] of [["Instagram", b.instagram], ["Google Maps", b.mapsUrl]] as const) if (u && safeUrl(u) === "#") notes.push(`Revisão: link do ${label} inválido.`);

  for (const s of c.sections) {
    if (!s.visible) continue;
    const btns = s.type === "hero" ? s.buttons : s.type === "cta" ? [s.button] : [];
    for (const btn of btns) if (btn.action === "link" && safeUrl(btn.href) === "#") notes.push(`Revisão: o botão "${btn.label}" não tem um link válido.`);
    if (s.type === "services" && s.items.some((i) => i.price && !/\d/.test(i.price))) notes.push("Revisão: há preço sem valor numérico em Serviços.");
  }

  const all = texts(c).join("\n");
  const ph = all.match(PLACEHOLDER);
  if (ph) notes.push(`Revisão: texto com cara de modelo/placeholder ("${ph[0]}"). Ajuste antes de publicar.`);
  const found = new Set<string>();
  for (const [re, label] of CLAIMS) if (re.test(all)) found.add(label);
  if (found.size) notes.push(`Revisão: o texto menciona ${[...found].join(", ")}. Mantenha só se a empresa puder comprovar.`);
  return notes;
}
