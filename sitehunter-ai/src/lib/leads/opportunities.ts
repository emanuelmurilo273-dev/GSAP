import { isSocialUrl, phonesMatch } from "./normalize";
import type { Facts, Opportunity, PresenceReport } from "./types";

const W = { high: 30, medium: 15, low: 7 } as const;

/** Detecta oportunidades a partir de observações registradas. Função pura. */
export function detectOpportunities(facts: Facts, presence: PresenceReport, now = new Date()): { list: Opportunity[]; score: number } {
  const list: Opportunity[] = [];
  const website = facts.website?.value ?? null;
  const add = (o: Opportunity) => list.push(o);

  if (!website) {
    const social = presence.kind === "social" || (facts.socials?.value && !website);
    if (presence.kind === "social" || (presence.url && isSocialUrl(presence.url))) {
      add({ code: "social_only", label: "Só rede social", detail: "A fonte informa apenas um perfil em rede social como site.", severity: "high", basis: "confirmed", evidence: presence.url });
    } else {
      add({ code: "no_website", label: "Site não encontrado", detail: `${facts.website?.source ?? "A fonte"} não informa um site. Confirme antes do contato.`, severity: "high", basis: "inferred", evidence: social ? "Há perfil social, mas nenhum site próprio informado." : null });
    }
  } else if (presence.skipped === "demo") {
    add({ code: "outdated", label: "Site possivelmente desatualizado", detail: "Cenário fictício do modo demonstração.", severity: "medium", basis: "inferred", evidence: "demo" });
  } else if (presence.reachable === false) {
    add({ code: "site_unreachable", label: "Site fora do ar", detail: `O site informado não respondeu corretamente (${presence.error ?? `HTTP ${presence.status}`}) em ${new Date(presence.checkedAt).toLocaleDateString("pt-BR")}.`, severity: "high", basis: "confirmed", evidence: website });
  } else if (presence.reachable) {
    if (presence.https === false) add({ code: "no_https", label: "Sem HTTPS", detail: "O site abre sem conexão segura (HTTPS).", severity: "medium", basis: "confirmed", evidence: presence.finalUrl });
    if (presence.hasViewport === false) add({ code: "not_mobile", label: "Não adaptado ao celular", detail: "A página inicial não declara a meta tag viewport, sinal comum de layout não responsivo.", severity: "medium", basis: "confirmed", evidence: "meta viewport ausente" });
    if (presence.copyrightYear && presence.copyrightYear <= now.getFullYear() - 3) add({ code: "outdated", label: "Site desatualizado", detail: `O rodapé indica © ${presence.copyrightYear}.`, severity: "medium", basis: "confirmed", evidence: `© ${presence.copyrightYear}` });
    if (!presence.title || !presence.description) add({ code: "missing_seo", label: "SEO básico incompleto", detail: `Falta ${!presence.title ? "título" : ""}${!presence.title && !presence.description ? " e " : ""}${!presence.description ? "meta descrição" : ""} na página inicial.`, severity: "low", basis: "confirmed", evidence: null });
    const sitePhones = presence.phones ?? [];
    if (facts.phone?.value && sitePhones.length && !sitePhones.some((p) => phonesMatch(p, facts.phone!.value))) {
      add({ code: "inconsistent_phone", label: "Telefone divergente", detail: `O telefone da fonte (${facts.phone.value}) é diferente do publicado no site (${sitePhones[0]}).`, severity: "medium", basis: "confirmed", evidence: sitePhones.join(", ") });
    }
  }
  if (!facts.phone?.value && !facts.email?.value) add({ code: "missing_contact", label: "Contato difícil", detail: "Nenhum telefone ou e-mail comercial encontrado nas fontes.", severity: "low", basis: "confirmed", evidence: null });

  const score = Math.min(100, list.reduce((s, o) => s + W[o.severity], 0));
  return { list, score };
}

export const OPPORTUNITY_FILTERS: { code: Opportunity["code"] | "any_site_issue"; label: string }[] = [
  { code: "no_website", label: "Sem site" },
  { code: "social_only", label: "Só rede social" },
  { code: "any_site_issue", label: "Site com problemas" },
  { code: "inconsistent_phone", label: "Dados inconsistentes" },
];
