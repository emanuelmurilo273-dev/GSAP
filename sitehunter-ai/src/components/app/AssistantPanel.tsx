"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };
type State = { configured: boolean; model: string | null } | "loading" | "error";

const SUGGEST_LEAD = ["Resuma esta empresa e diga o que dá para oferecer.", "Escreva uma abordagem curta por telefone para esta empresa.", "Que direção visual combina com este negócio e por quê?"];
const SUGGEST_GENERAL = ["Como encontro oficinas e autopeças com telefone na minha cidade?", "Que ramos têm mais chance de não ter site?", "Me ajude a montar uma sequência de abordagem sem soar como spam."];

/** Painel do Claude dentro do Hunter. Fala só com /api/assistant: a chave da Anthropic fica no servidor. */
export function AssistantPanel() {
  const path = usePathname();
  const leadId = /^\/app\/leads\/([a-z0-9]{10,40})/i.exec(path)?.[1];
  const page = path.startsWith("/app/leads") ? "Leads" : path.startsWith("/app/buscar") ? "Buscar empresas" : path.startsWith("/app/sites") ? "Prévias de sites" : path.startsWith("/app/abordagens") ? "Abordagens" : path.startsWith("/admin") ? "Painel administrativo" : "Hunter";
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("loading");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || state !== "loading") return;
    fetch("/api/assistant").then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => setState(j), () => setState("error"));
  }, [open, state]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 60); }, [open, state]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [msgs]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  function close() { abort.current?.abort(); setOpen(false); fab.current?.focus(); }

  const send = useCallback(async (q: string) => {
    const content = q.trim();
    if (!content || busy) return;
    setErr(null); setText("");
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    const ac = new AbortController(); abort.current = ac;
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ac.signal, body: JSON.stringify({ messages: next, context: { page, leadId } }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        if (j.code === "assistant_not_configured") setState({ configured: false, model: null });
        throw new Error(j.error ?? "Não foi possível falar com o Claude.");
      }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).replace(/^data: /, ""); buf = buf.slice(i + 2);
          try {
            const ev = JSON.parse(line);
            if (ev.t) setMsgs((m) => { const c = [...m]; const last = c[c.length - 1]!; c[c.length - 1] = { ...last, content: last.content + ev.t }; return c; });
            if (ev.error) throw new Error(ev.error);
          } catch (e) { if (e instanceof Error && e.message && !(e instanceof SyntaxError)) throw e; }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr((e as Error).message);
      setMsgs((m) => (m.length && m[m.length - 1]!.role === "assistant" && !m[m.length - 1]!.content ? m.slice(0, -1) : m));
    } finally { setBusy(false); abort.current = null; }
  }, [msgs, busy, page, leadId]);

  const ready = typeof state === "object" && state.configured;
  const chips = leadId ? SUGGEST_LEAD : SUGGEST_GENERAL;
  return (
    <>
      <button ref={fab} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} data-assistant-open
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-black/40 transition hover:bg-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 lg:bottom-6 lg:right-6">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2zm7 12l.9 2.6L22.5 17l-2.6.9L19 20.5l-.9-2.6-2.6-.9 2.6-.9L19 14z" /></svg>
        Claude
      </button>
      {open && (
        <section role="dialog" aria-label="Conversa com o Claude" data-assistant-panel className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-white/10 bg-ink-900 shadow-2xl shadow-black/60 animate-fade-up">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0"><h2 className="font-display text-base font-semibold text-white">Claude no Hunter</h2><p className="truncate text-xs text-slate-400">{ready ? `Modelo ${(state as { model: string }).model} · ${leadId ? "empresa em foco" : page}` : "Assistente de prospecção"}</p></div>
            <div className="flex items-center gap-1">
              {msgs.length > 0 && <button type="button" onClick={() => { abort.current?.abort(); setMsgs([]); setErr(null); }} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/5 hover:text-white">Nova conversa</button>}
              <button type="button" onClick={close} aria-label="Fechar o Claude" className="rounded-lg p-2 text-slate-300 hover:bg-white/5 hover:text-white"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
            </div>
          </header>

          {state === "loading" && <p className="p-6 text-sm text-slate-400">Verificando a integração…</p>}
          {state === "error" && <p className="p-6 text-sm text-red-300">Não foi possível verificar a integração. Recarregue a página.</p>}

          {typeof state === "object" && !state.configured && (
            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm text-slate-300" data-assistant-setup>
              <p className="font-semibold text-white">Falta ligar o Claude neste servidor.</p>
              <p>O Hunter usa a API oficial da Anthropic. Isso é separado da assinatura do aplicativo Claude (Pro ou Max): a API tem chave e cobrança próprias.</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Crie uma conta e uma chave de API em <a className="text-brand-300 underline" href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a> e adicione crédito.</li>
                <li>No arquivo <code>.env.local-docker</code> da pasta do Hunter, adicione a linha <code>ANTHROPIC_API_KEY=sua-chave</code> e salve.</li>
                <li>Reinicie o Hunter: <code>docker compose -f docker-compose.local.yml up -d</code>.</li>
              </ol>
              <p className="text-xs text-slate-500">A chave fica só no servidor e nunca chega ao navegador. A mesma chave liga os textos com IA dos sites e das abordagens. Opcional: <code>ASSISTANT_MODEL</code> para escolher o modelo.</p>
            </div>
          )}

          {ready && (
            <>
              <div ref={log} className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-busy={busy}>
                {msgs.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">Pergunte sobre {leadId ? "esta empresa" : "prospecção, busca, sites e abordagens"}. Eu só redijo e sugiro: o Hunter não envia mensagens por você.</p>
                    <div className="flex flex-col gap-2">{chips.map((c) => <button key={c} type="button" onClick={() => send(c)} className="rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-brand-500/50 hover:bg-white/[0.03]">{c}</button>)}</div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "ml-8 rounded-2xl rounded-br-md bg-brand-500/15 px-3.5 py-2.5 text-sm text-white" : "mr-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-200"}>
                    {m.content || (busy && i === msgs.length - 1 ? <span className="text-slate-500">Pensando…</span> : null)}
                  </div>
                ))}
                {err && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-200">{err}</p>}
              </div>
              <form className="border-t border-white/10 p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
                <label htmlFor="assistant-input" className="sr-only">Mensagem para o Claude</label>
                <div className="flex items-end gap-2">
                  <textarea id="assistant-input" ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={2} placeholder="Escreva sua pergunta"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
                    className="input min-h-[44px] flex-1 resize-none text-sm" />
                  {busy
                    ? <button type="button" onClick={() => abort.current?.abort()} className="btn-secondary px-3 py-2.5 text-sm">Parar</button>
                    : <button type="submit" disabled={!text.trim()} className="btn-primary px-4 py-2.5 text-sm">Enviar</button>}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-500">O texto da conversa{leadId ? " e os dados publicados desta empresa" : ""} é enviado à Anthropic para gerar a resposta. A conversa não fica salva no Hunter. Confira os fatos antes de usar.</p>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
