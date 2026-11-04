import { env } from "../env";
import { isAllowed, parseRobots, BOT_TOKEN } from "./robots";
import { BlockedAddressError, safeFetch } from "./safeFetch";
import { isSocialUrl, socialNetwork } from "./normalize";
import type { PresenceReport, Social } from "./types";

// Análise de presença digital: lê APENAS a página inicial pública do site
// informado pela fonte, depois de conferir o robots.txt. Não segue links,
// não envia formulários, não contorna login/CAPTCHA.

export function userAgent() {
  return `${BOT_TOKEN}/1.0 (+${env.appUrl}/bot; verificação pontual de presença digital)`;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c).slice(0, 300) : null;
}

const GENERIC_EMAIL = /^(contato|contact|atendimento|comercial|vendas|sac|info|hello|ola|faleconosco|reservas|agendamento|financeiro|suporte|support|recepcao|clinica|loja|orcamento)[._-]?\w*@/i;

/** Extrai sinais da página inicial. Função pura (testável). */
export function analyzeHtml(html: string, pageUrl: string, now = new Date()): Omit<PresenceReport, "checkedAt" | "url" | "kind"> {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:[^<\d]{0,20})?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].map((m) => Number(m[2] ?? m[1]));
  const copyrightYear = years.length ? Math.max(...years.filter((y) => y <= now.getFullYear() + 1)) : null;
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => decode(m[1]!));
  const socials: Social[] = [];
  const seen = new Set<string>();
  for (const h of hrefs) {
    if (!/^https?:\/\//i.test(h) || !isSocialUrl(h)) continue;
    const net = socialNetwork(h);
    if (!net || /share|sharer|intent|dialog/i.test(h)) continue;
    const key = h.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    socials.push({ network: net, url: h.replace(/[?#].*$/, ""), source: `Site da empresa (${pageUrl})` });
  }
  // Somente e-mails de contato comercial genéricos (contato@, atendimento@...): evita dados pessoais.
  const emails = [...new Set(hrefs.filter((h) => h.toLowerCase().startsWith("mailto:")).map((h) => h.slice(7).split("?")[0]!.trim().toLowerCase()))]
    .filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && GENERIC_EMAIL.test(e))
    .slice(0, 3);
  const phones = [...new Set(hrefs.filter((h) => h.toLowerCase().startsWith("tel:")).map((h) => h.slice(4).trim()))].slice(0, 3);
  const og = meta(html, "og:image");
  const imageCandidates = og && /^https?:\/\//.test(og) ? [{ url: og, alt: meta(html, "og:image:alt") ?? "", sourceUrl: pageUrl }] : [];
  return {
    title: title ? decode(title).slice(0, 200) : null,
    description: meta(html, "description") ?? meta(html, "og:description"),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    copyrightYear,
    generator: meta(html, "generator"),
    socials: socials.slice(0, 8),
    emails,
    phones,
    imageCandidates,
  };
}

export async function checkPresence(website: string | null, opts: { demo?: boolean } = {}): Promise<PresenceReport> {
  const checkedAt = new Date().toISOString();
  if (!website) return { checkedAt, url: null, kind: "none", skipped: "no_website" };
  if (isSocialUrl(website)) return { checkedAt, url: website, kind: "social", skipped: "social_only" };
  if (opts.demo) return { checkedAt, url: website, kind: "site", skipped: "demo" };
  let url: URL;
  try {
    url = new URL(website);
  } catch {
    return { checkedAt, url: website, kind: "site", skipped: "invalid_url" };
  }
  const ua = userAgent();
  try {
    // RFC 9309: 4xx no robots.txt = sem restrições; 5xx/erro de rede = assumir bloqueio total.
    let robots;
    try {
      robots = await safeFetch(new URL("/robots.txt", url).toString(), { userAgent: ua, timeoutMs: 5000, maxBytes: 200_000 });
    } catch (e) {
      if (e instanceof BlockedAddressError) throw e;
      return { checkedAt, url: website, kind: "site", reachable: false, status: null, error: e instanceof Error && e.name === "TimeoutError" ? "o servidor do site não respondeu a tempo" : "o servidor do site não respondeu" };
    }
    if (robots.status >= 500) return { checkedAt, url: website, kind: "site", reachable: false, status: robots.status, error: `o servidor respondeu com erro ${robots.status}` };
    if (robots.status === 200 && !/text\/html/i.test(robots.contentType) && !isAllowed(parseRobots(robots.body), url.pathname || "/")) {
      return { checkedAt, url: website, kind: "site", skipped: "robots_disallowed" };
    }
    const r = await safeFetch(url.toString(), { userAgent: ua, timeoutMs: 7000 });
    const ok = r.status >= 200 && r.status < 400;
    return {
      checkedAt,
      url: website,
      kind: "site",
      reachable: ok,
      status: r.status,
      finalUrl: r.finalUrl,
      https: r.finalUrl.startsWith("https://"),
      responseMs: r.ms,
      ...(ok && /html/i.test(r.contentType || "text/html") ? analyzeHtml(r.body, r.finalUrl) : {}),
    };
  } catch (e) {
    if (e instanceof BlockedAddressError) return { checkedAt, url: website, kind: "site", skipped: "blocked_address" };
    return { checkedAt, url: website, kind: "site", reachable: false, status: null, error: e instanceof Error && e.name === "TimeoutError" ? "tempo esgotado" : "não foi possível acessar" };
  }
}
