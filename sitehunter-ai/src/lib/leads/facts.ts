import { isSocialUrl, normalizeDomain, phonesMatch } from "./normalize";
import type { Fact, FactField, Facts, PresenceReport, RawBusiness, Social } from "./types";

// Monta a proveniência de cada campo a partir da fonte de descoberta e da
// análise do site. Regra: nada é "confirmed" sem uma fonte pública.

function f(value: string | null, status: Fact["status"], source: string, sourceUrl: string | null | undefined, confidence: number, at: string, note?: string): Fact {
  return { value, status, source, sourceUrl: sourceUrl ?? null, confidence, collectedAt: at, ...(note ? { note } : {}) };
}

export function buildFacts(raw: RawBusiness, presence: PresenceReport, at = new Date().toISOString()): { facts: Facts; socials: Social[]; email: string | null } {
  const demo = raw.source.provider === "demo";
  const fromUser = raw.source.provider === "import";
  const baseStatus: Fact["status"] = fromUser ? "user" : "confirmed";
  const conf = demo ? 0 : fromUser ? 0.7 : 0.9;
  const src = raw.source.label;
  const srcUrl = raw.source.url;
  const known = (v: string | null, field: string) =>
    v ? f(v, baseStatus, src, srcUrl, conf, at, demo ? "Dado fictício (modo demonstração)" : undefined) : f(null, "not_found", src, srcUrl, 0, at, `${src} não informa ${field}.`);

  const facts: Facts = {
    name: known(raw.name, "nome"),
    category: known(raw.category, "categoria"),
    address: known(raw.address, "endereço"),
    phone: known(raw.phone, "telefone"),
  };

  // Site
  if (raw.website && !isSocialUrl(raw.website)) {
    const reach = presence.reachable === false ? " — o endereço não respondeu na verificação" : "";
    facts.website = f(raw.website, baseStatus, src, srcUrl, presence.reachable ? Math.max(conf, 0.95) : conf * 0.8, at, (demo ? "Dado fictício (modo demonstração)" : undefined) ?? (reach || undefined));
  } else {
    facts.website = f(null, "inferred", src, srcUrl, 0.5, at, raw.website ? "A fonte informa somente um perfil social, não um site próprio." : `${src} não informa um site. Isso não prova que a empresa não tenha site: confira antes do contato.`);
  }

  // Redes sociais: da fonte + links publicados no próprio site
  const socials: Social[] = [];
  if (raw.website && isSocialUrl(raw.website)) socials.push({ network: normalizeDomain(raw.website)!.split(".")[0]!, url: raw.website, source: src });
  for (const s of presence.socials ?? []) if (!socials.some((x) => x.url.toLowerCase() === s.url.toLowerCase())) socials.push(s);
  facts.socials = socials.length
    ? f(socials.map((s) => s.url).join(" "), demo ? "confirmed" : baseStatus, socials.length > (raw.website && isSocialUrl(raw.website) ? 1 : 0) ? "Site da empresa" : src, presence.finalUrl ?? srcUrl, demo ? 0 : 0.85, at, demo ? "Dado fictício (modo demonstração)" : undefined)
    : f(null, "not_found", presence.reachable ? "Site da empresa" : src, presence.finalUrl ?? srcUrl, 0, at, "Nenhum perfil social encontrado nas fontes consultadas.");

  // E-mail comercial: da fonte, ou contato genérico publicado no site da empresa
  const email = raw.email ?? presence.emails?.[0] ?? null;
  facts.email = email
    ? f(email, raw.email ? baseStatus : "confirmed", raw.email ? src : "Site da empresa", raw.email ? srcUrl : presence.finalUrl, demo ? 0 : 0.85, at, demo ? "Dado fictício (modo demonstração)" : undefined)
    : f(null, "not_found", src, srcUrl, 0, at, "Nenhum e-mail comercial público encontrado.");

  // Telefone confirmado também pelo próprio site aumenta a confiança
  if (facts.phone?.value && presence.phones?.some((p) => phonesMatch(p, facts.phone!.value))) {
    facts.phone = { ...facts.phone, confidence: Math.max(facts.phone.confidence, 0.97), note: "Também publicado no site da empresa." };
  }
  return { facts, socials, email };
}

/** Correção manual: o valor passa a ser "informado pelo usuário" e o anterior é guardado na nota. */
export function applyUserEdit(facts: Facts, field: FactField, value: string | null, at = new Date().toISOString()): Facts {
  const prev = facts[field];
  const prevNote = prev?.value ? (prev.value !== value ? `Antes: "${prev.value}" (${prev.source}).` : prev.note) : prev ? `Antes: não encontrado (${prev.source}).` : undefined;
  return {
    ...facts,
    [field]: value
      ? { value, status: "user", source: "Revisado pelo usuário", sourceUrl: null, confidence: 1, collectedAt: at, note: prevNote }
      : { value: null, status: "not_found", source: "Revisado pelo usuário", sourceUrl: null, confidence: 1, collectedAt: at, note: prevNote ?? "Removido pelo usuário." },
  };
}
