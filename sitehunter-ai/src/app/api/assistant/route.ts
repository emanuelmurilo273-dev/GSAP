import { requireUser } from "@/lib/auth";
import { HttpError, json, parseJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { ChatBody, assistantConfigured, assistantModel, buildContext, streamAssistant } from "@/lib/assistant";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Estado da integração (sem expor nenhum segredo): o painel usa para mostrar o passo a passo quando falta a chave.
export const GET = route(async () => {
  await requireUser();
  return json({ configured: assistantConfigured(), model: assistantConfigured() ? assistantModel() : null });
}, { csrf: false });

// Conversa com o Claude (streaming em SSE). Chave só no servidor; a conversa não é gravada.
export const POST = route(async (req) => {
  const user = await requireUser();
  if (!assistantConfigured()) throw new HttpError(503, "O Claude ainda não está configurado neste servidor.", "assistant_not_configured");
  await rateLimit(`assistant:${user.id}`, 30, 600);
  const body = await parseJson(req, ChatBody);
  const context = await buildContext(user.id, body.context);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        for await (const t of streamAssistant(body, context, undefined, req.signal)) send({ t });
        send({ done: true });
      } catch (e) {
        log("warn", "assistant_failed", { error: e instanceof Error ? e.message : String(e) });
        // Mensagem genérica: detalhes da API (e qualquer eco de chave) ficam só no log do servidor.
        send({ error: "Não foi possível falar com o Claude agora. Tente de novo em instantes." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
});
