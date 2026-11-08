import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { cleanDb, makeUser } from "./helpers";
import { sha256 } from "@/lib/crypto";

let token = "";
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (n === "sh_session" && token ? { value: token } : undefined), set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));

const seen: { system?: string; model?: string; messages?: unknown }[] = [];
let failStream = false;
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: (args: { system: string; model: string; messages: unknown }) => {
        seen.push(args);
        return (async function* () {
          if (failStream) throw new Error("401 invalid x-api-key sk-ant-SEGREDO-NAO-VAZAR");
          for (const t of ["Olá, ", "tudo ", "bem."]) yield { type: "content_block_delta", delta: { type: "text_delta", text: t } };
          yield { type: "message_stop" };
        })();
      },
    };
  },
}));

const origin = "http://localhost:3000";
const post = (body: unknown) => new Request(`${origin}/api/assistant`, { method: "POST", headers: { origin, host: "localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({}) };
async function login(userId: string) { token = `s-${userId}-${Date.now()}`; await prisma.session.create({ data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600e3) } }); }
const sse = async (res: Response) => (await res.text()).split("\n\n").filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, "")));

describe("Claude dentro do Hunter", () => {
  beforeEach(async () => { await cleanDb(); token = ""; seen.length = 0; failStream = false; process.env.ACCESS_MODE = "saas"; process.env.ANTHROPIC_API_KEY = "sk-ant-teste"; });
  afterEach(() => { delete process.env.ACCESS_MODE; delete process.env.ANTHROPIC_API_KEY; });

  it("exige login e informa quando a chave não está configurada, sem expor nada", async () => {
    const { GET, POST } = await import("@/app/api/assistant/route");
    expect((await GET(new Request(`${origin}/api/assistant`), ctx)).status).toBe(401);
    const u = await makeUser("a@exemplo.dev"); await login(u.id);
    delete process.env.ANTHROPIC_API_KEY;
    const st = await (await GET(new Request(`${origin}/api/assistant`), ctx)).json();
    expect(st).toEqual({ configured: false, model: null });
    const r = await POST(post({ messages: [{ role: "user", content: "oi" }] }), ctx);
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe("assistant_not_configured");
  });

  it("responde em streaming com o contexto da empresa do próprio usuário (e só dela)", async () => {
    const { POST, GET } = await import("@/app/api/assistant/route");
    const u = await makeUser("b@exemplo.dev"), outro = await makeUser("c@exemplo.dev");
    const mine = await prisma.company.create({ data: { userId: u.id, source: "osm", sourceId: "node/1", name: "Pneus do Zé", category: "Pneus e borracharia", city: "Porto Alegre", state: "RS", phone: "5551999990000" } });
    const theirs = await prisma.company.create({ data: { userId: outro.id, source: "osm", sourceId: "node/2", name: "Empresa Alheia Secreta", category: "Autopeças", city: "Recife", state: "PE", phone: "5581988880000" } });
    await login(u.id);
    expect((await (await GET(new Request(`${origin}/api/assistant`), ctx)).json()).configured).toBe(true);
    const r = await POST(post({ messages: [{ role: "user", content: "Resuma." }], context: { page: "Leads", leadId: mine.id } }), ctx);
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    const ev = await sse(r);
    expect(ev.filter((e) => e.t).map((e) => e.t).join("")).toBe("Olá, tudo bem.");
    expect(ev.at(-1)).toEqual({ done: true });
    expect(seen[0]!.system).toContain("Pneus do Zé");
    expect(seen[0]!.system).toContain("(51) 99999-0000");
    expect(seen[0]!.system).toContain("<contexto_hunter>");
    // lead de outro usuário não entra no contexto
    await POST(post({ messages: [{ role: "user", content: "Resuma." }], context: { leadId: theirs.id } }), ctx);
    expect(seen[1]!.system).not.toContain("Empresa Alheia Secreta");
    expect(seen[1]!.system).not.toContain("81988880000");
  });

  it("erro da API vira mensagem genérica: nada da chave ou do erro técnico chega ao navegador", async () => {
    const { POST } = await import("@/app/api/assistant/route");
    const u = await makeUser("d@exemplo.dev"); await login(u.id);
    failStream = true;
    const text = await (await POST(post({ messages: [{ role: "user", content: "oi" }] }), ctx)).text();
    expect(text).toContain("Não foi possível falar com o Claude");
    expect(text).not.toContain("sk-ant");
    expect(text).not.toContain("SEGREDO");
  });

  it("valida a conversa: última mensagem do usuário, tamanho e limite de uso", async () => {
    const { POST } = await import("@/app/api/assistant/route");
    const u = await makeUser("e@exemplo.dev"); await login(u.id);
    expect((await POST(post({ messages: [{ role: "assistant", content: "x" }] }), ctx)).status).toBe(400);
    expect((await POST(post({ messages: [{ role: "user", content: "a".repeat(4001) }] }), ctx)).status).toBe(400);
    expect((await POST(post({ messages: [] }), ctx)).status).toBe(400);
    let last = 200;
    for (let i = 0; i < 32; i++) last = (await POST(post({ messages: [{ role: "user", content: "oi" }] }), ctx)).status;
    expect(last).toBe(429);
  });

  it("a chave não aparece em nenhum arquivo enviado ao navegador", () => {
    const client = readFileSync("src/components/app/AssistantPanel.tsx", "utf8");
    expect(client).not.toMatch(/process\.env|sk-ant|@anthropic-ai\/sdk|x-api-key/i);
    expect(client).toContain("/api/assistant");
  });
});
