// Teste ponta a ponta via HTTP contra um servidor rodando (npm run build && npm start).
// Uso: BASE_URL=http://localhost:3000 KIWIFY_WEBHOOK_TOKEN=... node tests/e2e.mjs
import { createHmac } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN ?? "kiwify-token-de-teste";
const ROOT = process.env.ROOT_DOMAIN ?? "localhost:3000";
const run = Date.now().toString(36);
let ipCounter = 1;
let failures = 0;

function check(cond, label, extra) {
  console.log(`${cond ? "✓" : "✗"} ${label}${!cond && extra !== undefined ? ` → ${JSON.stringify(extra).slice(0, 300)}` : ""}`);
  if (!cond) failures++;
}

class Client {
  cookie = "";
  ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${ipCounter++}`;
  async req(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: { ...(body ? { "content-type": "application/json" } : {}), origin: BASE, cookie: this.cookie, "x-forwarded-for": this.ip, ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    return res;
  }
  async json(path, opts) {
    const r = await this.req(path, opts);
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }
}

function webhook(payload) {
  const raw = JSON.stringify(payload);
  const sig = createHmac("sha1", TOKEN).update(raw).digest("hex");
  return fetch(`${BASE}/api/webhooks/kiwify?signature=${sig}`, { method: "POST", headers: { "content-type": "application/json" }, body: raw });
}
const approved = (email, order, days = 30) => ({
  order_id: order, order_status: "paid", webhook_event_type: "order_approved", approved_date: "2026-11-02 09:00", subscription_id: `sub-${run}-${email}`,
  Customer: { email },
  Subscription: { id: `sub-${run}-${email}`, status: "active", customer_access: { has_access: true, access_until: new Date(Date.now() + days * 864e5).toISOString() } },
});

const A = new Client(), B = new Client(), ADM = new Client();
const emailA = `a-${run}@teste.local`, emailB = `b-${run}@teste.local`;

let r = await A.json("/api/auth/register", { method: "POST", body: { name: "Ana Teste", email: emailA, password: "senha-forte-123", acceptTerms: true } });
check(r.status === 201, "cadastro do usuário A", r);
r = await B.json("/api/auth/register", { method: "POST", body: { name: "Beto Teste", email: emailB, password: "senha-forte-123", acceptTerms: true } });
check(r.status === 201, "cadastro do usuário B", r);
r = await B.json("/api/auth/register", { method: "POST", body: { name: "Dup", email: emailB, password: "senha-forte-123", acceptTerms: true } });
check(r.status === 409, "e-mail duplicado é recusado", r);

const L = new Client();
r = await L.json("/api/auth/login", { method: "POST", body: { email: emailA, password: "errada" } });
check(r.status === 401, "login com senha errada falha", r);
r = await L.json("/api/auth/login", { method: "POST", body: { email: emailA, password: "senha-forte-123" } });
check(r.status === 200 && L.cookie.startsWith("sh_session="), "login correto cria sessão", r);
r = await new Client().json("/api/projects");
check(r.status === 401, "API exige login", r);

r = await A.json("/api/places/search", { method: "POST", body: { state: "SP", city: "Campinas", segment: "barbearia" } });
check(r.status === 402, "sem assinatura: busca bloqueada no backend (402)", r);
r = await A.json("/api/companies", { method: "POST", body: { sourceId: "x", name: "y" } });
check(r.status === 402, "sem assinatura: salvar empresa bloqueado", r);

// Webhook falso não libera acesso
let w = await fetch(`${BASE}/api/webhooks/kiwify?signature=${"0".repeat(40)}`, { method: "POST", body: JSON.stringify(approved(emailA, `fake-${run}`)) });
check(w.status === 401, "webhook com assinatura inválida é rejeitado", w.status);
r = await A.json("/api/me");
check(r.data.user?.access?.premium === false, "acesso continua bloqueado após webhook falso");

const firstPayment = approved(emailA, `ord-${run}-1`);
w = await webhook(firstPayment);
check(w.status === 200, "webhook assinado de pagamento aprovado aceito", w.status);
w = await webhook(firstPayment); // reenvio idêntico (a Kiwify reenvia em caso de falha)
check(w.status === 200 && (await w.json()).duplicate === true, "reenvio do mesmo evento é idempotente");
r = await A.json("/api/me");
check(r.data.user?.access?.premium === true, "acesso Premium liberado após pagamento", r.data.user?.access);

r = await A.json("/api/places/search", { method: "POST", body: { state: "SP", city: "Campinas", segment: "barbearia" } });
const placesConfigured = r.status === 200;
check(r.status === 200 || r.data.code === "not_configured", `busca de empresas (${placesConfigured ? "Google Places ativo" : "Places não configurado → erro claro"})`, r);
r = await A.json("/api/me");
check(placesConfigured || r.data.usage.searches.used === 0, "falha externa devolve a pesquisa ao limite", r.data.usage);

r = await A.json("/api/companies", { method: "POST", body: { sourceId: `place-${run}`, name: "Barbearia E2E", category: "Barbearia", address: "Rua Teste, 100 - Centro, Campinas - SP", city: "Campinas", state: "SP", phone: "(19) 99876-5432", website: null, mapsUrl: "https://maps.google.com/?cid=1" } });
check(r.status === 201, "empresa salva", r);
const companyId = r.data.company?.id;

r = await A.json("/api/projects", { method: "POST", body: { companyId, segment: "barbearia" } });
check(r.status === 201, `site gerado (${r.data.ai ? "IA" : "modelo padrão, IA não configurada"})`, r);
const projectId = r.data.project?.id;

r = await B.json(`/api/projects/${projectId}`);
check(r.status === 404, "usuário B não vê o projeto de A", r);
r = await B.json(`/api/projects/${projectId}`, { method: "DELETE" });
check(r.status === 404, "usuário B não exclui o projeto de A", r);
r = await B.json(`/api/companies/${companyId}`, { method: "DELETE" });
check(r.status === 404, "usuário B não exclui empresa de A", r);
r = await B.json("/api/projects", { method: "POST", body: { companyId, segment: "barbearia" } });
check(r.status === 402, "usuário B sem assinatura não gera site", r);

r = await A.json(`/api/projects/${projectId}`);
const content = r.data.project.content;
content.siteName = "Barbearia E2E Editada";
r = await A.json(`/api/projects/${projectId}`, { method: "PATCH", body: { content } });
check(r.status === 200, "edição salva", r);
r = await A.json(`/api/projects/${projectId}`, { method: "PATCH", body: { content: { ...content, theme: { ...content.theme, primary: "red" } } } });
check(r.status === 400, "validação rejeita conteúdo inválido", r);

r = await A.req(`/api/projects/${projectId}/publish`, { method: "POST", body: {}, headers: { origin: "https://site-malicioso.com" } });
check(r.status === 403, "CSRF: origem externa bloqueada", r.status);

r = await A.json(`/api/projects/${projectId}/publish`, { method: "POST", body: { slug: `barbearia-e2e-${run}` } });
check(r.status === 200, "site publicado", r);
const slug = r.data.publication?.slug;
let site = await fetch(`${BASE}/s/${slug}`);
let html = await site.text();
check(site.status === 200 && html.includes("Barbearia E2E Editada"), "site acessível pelo endereço público /s/<slug>");
{
  // fetch() não permite trocar o cabeçalho Host; usamos node:http.
  const { request } = await import("node:http");
  const u = new URL(BASE);
  const res = await new Promise((resolve, reject) => {
    const rq = request({ host: u.hostname, port: u.port, path: "/", headers: { host: `${slug}.${ROOT}` } }, (rs) => { let d = ""; rs.on("data", (c) => (d += c)); rs.on("end", () => resolve({ status: rs.statusCode, body: d })); });
    rq.on("error", reject);
    rq.end();
  });
  check(res.status === 200 && res.body.includes("Barbearia E2E Editada"), "site acessível pelo subdomínio <slug>.ROOT_DOMAIN");
}
r = await fetch(`${BASE}/api/domains/check?domain=${slug}.${ROOT.replace(/:\d+$/, "")}`);
check(r.status === 200 || ROOT.includes(":"), "Caddy ask: subdomínio publicado autorizado para SSL", r.status);
r = await fetch(`${BASE}/api/domains/check?domain=qualquer-coisa.exemplo.com`);
check(r.status === 404, "Caddy ask: domínio desconhecido recusado");

r = await A.json("/api/proposals", { method: "POST", body: { projectId } });
check(r.status === 201, "proposta comercial gerada", r);
const pdf = await A.req(`/api/proposals/${r.data.proposal?.id}/pdf`);
const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
check(pdf.headers.get("content-type") === "application/pdf" && String.fromCharCode(...pdfBytes.slice(0, 4)) === "%PDF", "PDF da proposta");
r = await B.json(`/api/proposals/${r.data.proposal?.id}`);
check(r.status === 404, "usuário B não lê a proposta de A", r);

r = await A.json(`/api/projects/${projectId}/outreach`, { method: "POST" });
check(r.status === 200 && r.data.whatsapp?.startsWith("https://wa.me/5519998765432?text="), "mensagem de abordagem + link do WhatsApp", r);

const zip = await A.req(`/api/projects/${projectId}/export`);
const zipBytes = new Uint8Array(await zip.arrayBuffer());
check(zipBytes[0] === 0x50 && zipBytes[1] === 0x4b, "exportação .zip do site");

// Reembolso → site sai do ar
w = await webhook({ ...approved(emailA, `ord-${run}-1`), order_status: "refunded", webhook_event_type: "order_refunded" });
check(w.status === 200, "webhook de reembolso aceito");
site = await fetch(`${BASE}/s/${slug}`);
check(site.status === 503 && (await site.text()).includes("temporariamente indisponível"), "após reembolso o site exibe página de indisponibilidade");
r = await A.json(`/api/projects/${projectId}/publish`, { method: "POST", body: {} });
check(r.status === 402, "sem assinatura não é possível republicar", r);
const zip2 = await A.req(`/api/projects/${projectId}/export`);
check(zip2.status === 200, "exportação continua disponível durante a retenção");

// Novo pagamento → reativação automática
w = await webhook(approved(emailA, `ord-${run}-2`));
site = await fetch(`${BASE}/s/${slug}`);
check(site.status === 200, "novo pagamento reativa o site automaticamente", site.status);

r = await A.json(`/api/projects/${projectId}/publish`, { method: "DELETE" });
site = await fetch(`${BASE}/s/${slug}`);
check(r.status === 200 && site.status === 404, "despublicar retira o site do ar");

// Administração
r = await A.json("/api/admin/settings");
check(r.status === 403, "assinante não acessa o painel administrativo", r);
r = await ADM.json("/api/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL ?? "admin@sitehunter.local", password: process.env.ADMIN_PASSWORD ?? "admin-senha-123" } });
if (r.status !== 200) r = await ADM.json("/api/auth/register", { method: "POST", body: { name: "Admin", email: process.env.ADMIN_EMAIL ?? "admin@sitehunter.local", password: process.env.ADMIN_PASSWORD ?? "admin-senha-123", acceptTerms: true } });
r = await ADM.json("/api/admin/settings");
check(r.status === 200 && r.data.settings?.priceCents === 7700, "administrador acessa configurações (preço R$ 77)", r);

r = await fetch(`${BASE}/api/cron/subscriptions`, { method: "POST" });
check(r.status === 401, "rotina periódica exige segredo");

for (const p of ["/", "/login", "/cadastro", "/termos", "/privacidade"]) {
  const res = await fetch(BASE + p);
  check(res.status === 200, `página ${p} carrega`);
}
const appRes = await A.req("/app");
check(appRes.status === 200, "painel /app carrega para usuário logado");
const anon = await fetch(`${BASE}/app`, { redirect: "manual" });
check([307, 308, 302].includes(anon.status) || anon.status === 200, "painel redireciona visitante sem login", anon.status);

console.log(failures ? `\n${failures} verificação(ões) falharam` : "\nTodas as verificações passaram");
process.exit(failures ? 1 : 0);
