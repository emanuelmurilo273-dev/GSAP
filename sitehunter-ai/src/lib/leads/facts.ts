import { isSocialUrl, normalizeDomain, phonesMatch } from "./normalize";
import { isBrMobile, normalizeWhatsApp } from "../whatsapp";
import { resolveCity, UFS } from "../br/cities";

const ufFromState = (st: string | null | undefined) => (st ? (Object.entries(UFS).find(([k, n]) => k === st.toUpperCase() || n.toLowerCase() === st.toLowerCase())?.[0] ?? null) : null);
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
  // Dados colaborativos (OSM) podem estar desatualizados: confiança um pouco menor.
  const conf = demo ? 0 : fromUser ? 0.7 : raw.source.provider === "osm" ? 0.8 : 0.9;
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

  // WhatsApp: confirmado só quando publicado como WhatsApp (fonte ou site da empresa).
  // Celular sem essa indicação é inferência: o usuário precisa confirmar antes de usar.
  const waSrc = normalizeWhatsApp(raw.whatsapp);
  const waSite = presence.siteMismatch ? null : normalizeWhatsApp(presence.whatsapp?.[0]);
  const waOther = presence.siteMismatch ? normalizeWhatsApp(presence.whatsapp?.[0]) : null;
  const mobile = normalizeWhatsApp(raw.phone);
  facts.whatsapp = waSrc
    ? f(waSrc, baseStatus, src, srcUrl, conf, at, demo ? "Dado fictício (modo demonstração)" : `Publicado como WhatsApp no ${src}.`)
    : waSite
      ? f(waSite, "confirmed", "Site da empresa", presence.whatsappPage ?? presence.finalUrl, demo ? 0 : presence.whatsappWritten ? 0.85 : 0.95, at, presence.whatsappWritten ? "Número indicado como WhatsApp no texto do site da empresa." : "Link de WhatsApp publicado no site da empresa.")
      : waOther
        ? f(waOther, "inferred", "Site informado na fonte", presence.finalUrl, 0.2, at, "O site informado na fonte não parece ser da empresa; este WhatsApp pode ser de outra entidade. Confirme antes de usar.")
      : isBrMobile(mobile)
        ? f(mobile, "inferred", src, srcUrl, 0.4, at, "Celular publicado, mas sem indicação de que usa WhatsApp: confirme antes de usar.")
        : f(null, "not_found", src, srcUrl, 0, at, "Nenhum WhatsApp comercial publicado nas fontes consultadas.");

  // DDD do WhatsApp diferente do DDD da cidade: avisa (pode ser o número central de uma rede ou franquia).
  const wf = facts.whatsapp;
  if (wf?.value && wf.status === "confirmed" && raw.city && wf.value.startsWith("55")) {
    const city = resolveCity(raw.city, ufFromState(raw.state)).city;
    const ddd = Number(wf.value.slice(2, 4));
    if (city && city.ddd !== ddd) wf.note = `${wf.note ?? ""} Atenção: o DDD ${ddd} não é o da cidade (${city.name}, DDD ${city.ddd}); pode ser o número central de uma rede. Confira antes de enviar.`.trim();
  }

  // Horários publicados pela fonte
  facts.hours = raw.hours?.length
    ? f(raw.hours.map((h) => `${h.label}: ${h.value}`).join(" · "), baseStatus, src, srcUrl, conf, at, demo ? "Dado fictício (modo demonstração)" : raw.hoursRaw && raw.source.provider === "osm" ? `Original: ${raw.hoursRaw}` : undefined)
    : f(null, "not_found", src, srcUrl, 0, at, `${src} não informa horários.`);

  // Redes sociais: da fonte + links publicados no próprio site
  const socials: Social[] = [];
  if (raw.website && isSocialUrl(raw.website)) socials.push({ network: normalizeDomain(raw.website)!.split(".")[0]!, url: raw.website, source: src });
  for (const u of raw.socialLinks ?? []) if (!socials.some((x) => x.url.toLowerCase() === u.toLowerCase())) socials.push({ network: normalizeDomain(u)?.split(".")[0] ?? "rede", url: u, source: src });
  for (const s of presence.socials ?? []) if (!socials.some((x) => x.url.toLowerCase() === s.url.toLowerCase())) socials.push(s);
  facts.socials = socials.length
    ? f(socials.map((s) => s.url).join(" "), demo ? "confirmed" : baseStatus, socials.some((x) => x.source.startsWith("Site da empresa")) ? "Site da empresa" : src, presence.finalUrl ?? srcUrl, demo ? 0 : 0.85, at, demo ? "Dado fictício (modo demonstração)" : undefined)
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
