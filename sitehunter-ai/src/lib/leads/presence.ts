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
  // WhatsApp publicado pela empresa no próprio site (wa.me, api.whatsapp.com, whatsapp://).
const linked = hrefs.map((h) => h.match(/(?:wa\.me\/|whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=|whatsapp:\/\/send\?(?:[^#]*&)?phone=)\+?(\d{10,15})/i)?.[1]).filter((x): x is string => !!x);
  // Também aceita o número escrito como WhatsApp no texto ("WhatsApp: (41) 99876-5432").
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const written = [...text.matchAll(/(?:whats\s?app|whats|zap)\s*[:\-–]?\s*((?:\+?55\s*)?\(?\d{2}\)?\s*9?\s*\d{4}[\s.-]?\d{4})/gi)].map((m) => m[1]!.replace(/\D/g, ""));
  const whatsapp = [...new Set([...linked, ...written])].slice(0, 3);
  const whatsappWritten = !linked.length && written.length > 0;
  // Imagens publicadas pela própria empresa: og:image, twitter:image e fotos grandes da página inicial.
  const abs = (u: string) => { try { return new URL(decode(u), pageUrl).toString(); } catch { return null; } };
  const found: { url: string; alt: string; sourceUrl: string }[] = [];
  const push = (u: string | null, alt: string) => { if (u && /^https:\/\//.test(u) && !found.some((f) => f.url === u) && !/logo|icon|sprite|favicon|avatar|pixel|placeholder|\.svg(\?|$)|\.gif(\?|$)/i.test(u)) found.push({ url: u, alt: alt.slice(0, 160), sourceUrl: pageUrl }); };
  push(meta(html, "og:image") ? abs(meta(html, "og:image")!) : null, meta(html, "og:image:alt") ?? "");
  push(meta(html, "twitter:image") ? abs(meta(html, "twitter:image")!) : null, "");
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (found.length >= 6) break;
    const tag = m[0];
    const src = tag.match(/\s(?:data-src|src)=["']([^"']+)["']/i)?.[1];
    const w = Number(tag.match(/\swidth=["']?(\d+)/i)?.[1] ?? 0);
    if (!src || (w && w < 300)) continue;
    if (!/\.(jpe?g|webp|png)(\?|$)/i.test(src)) continue;
    push(abs(src), decode(tag.match(/\salt=["']([^"']*)["']/i)?.[1] ?? ""));
  }
  const imageCandidates = found;
  return {
    title: title ? decode(title).slice(0, 200) : null,
    description: meta(html, "description") ?? meta(html, "og:description"),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    copyrightYear,
    generator: meta(html, "generator"),
    socials: socials.slice(0, 8),
    emails,
    phones,
    whatsapp,
    whatsappWritten,
    imageCandidates,
  };
}

/** Link para a página de contato do mesmo site (contato, fale conosco, atendimento...). */
export function contactLink(html: string, pageUrl: string): string | null {
  const base = new URL(pageUrl);
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = decode(m[1]!), label = m[2]!.replace(/<[^>]+>/g, " ");
    if (!/contat|contact|fale|atendimento|onde-estamos|localiza/i.test(`${href} ${label}`)) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "") && /^https?:$/.test(u.protocol) && u.href !== base.href) return u.href;
    } catch {}
  }
  return null;
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
    const analysis = ok && /html/i.test(r.contentType || "text/html") ? analyzeHtml(r.body, r.finalUrl) : {};
    const report: PresenceReport = {
      checkedAt,
      url: website,
      kind: "site",
      reachable: ok,
      status: r.status,
      finalUrl: r.finalUrl,
      https: r.finalUrl.startsWith("https://"),
      responseMs: r.ms,
      ...analysis,
    };
    // Sem WhatsApp na página inicial: lê também UMA página de contato do mesmo site (se o robots.txt permitir).
    if (ok && !report.whatsapp?.length) {
      const contact = contactLink(r.body, r.finalUrl);
      const rules = robots.status === 200 && !/text\/html/i.test(robots.contentType) ? parseRobots(robots.body) : null;
      if (contact && (!rules || isAllowed(rules, new URL(contact).pathname))) {
        try {
          const c = await safeFetch(contact, { userAgent: ua, timeoutMs: 6000 });
          if (c.status >= 200 && c.status < 400 && /html/i.test(c.contentType || "text/html")) {
            const a = analyzeHtml(c.body, c.finalUrl);
            if (a.whatsapp?.length) { report.whatsapp = a.whatsapp; report.whatsappWritten = a.whatsappWritten; report.whatsappPage = c.finalUrl; }
            for (const sc of a.socials ?? []) if (!report.socials?.some((x) => x.url === sc.url)) (report.socials ??= []).push(sc);
          }
        } catch {
          /* página de contato indisponível: segue só com a inicial */
        }
      }
    }
    return report;
  } catch (e) {
    if (e instanceof BlockedAddressError) return { checkedAt, url: website, kind: "site", skipped: "blocked_address" };
    return { checkedAt, url: website, kind: "site", reachable: false, status: null, error: e instanceof Error && e.name === "TimeoutError" ? "tempo esgotado" : "não foi possível acessar" };
  }
}


const GENERIC = new Set(["academia", "clinica", "odontologia", "odonto", "barbearia", "salao", "padaria", "restaurante", "oficina", "mecanica", "loja", "studio", "estudio", "casa", "centro", "instituto", "cafe", "pizzaria", "otica", "pet", "shop", "beleza", "cabeleireiro", "cabeleireiros", "auto", "center", "ltda", "comercio", "servicos"]);
const foldTxt = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * O site informado parece ser mesmo da empresa? Bases colaborativas às vezes trazem o site de outra
 * entidade (ex.: um órgão público). Sites de governo nunca contam; nos demais, ao menos uma palavra
 * própria do nome precisa aparecer no domínio ou no título. Sem palavra própria no nome, não dá para julgar.
 */
export function siteMatchesBusiness(name: string, url: string | null | undefined, title?: string | null): boolean {
  if (!url) return true;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return true; }
  if (/\.(gov|jus|leg|mil|mp)\.br$/.test(host)) return false;
  const tokens = foldTxt(name).split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !GENERIC.has(t));
  if (!tokens.length) return true;
  const hay = foldTxt(`${host} ${title ?? ""}`).replace(/[^a-z0-9 ]+/g, " ");
  const compact = hay.replace(/\s+/g, "");
  return tokens.some((t) => hay.includes(t) || compact.includes(t));
}
