"use client";
import { useMemo, useState } from "react";
import { normalizeWhatsApp, waMeLink } from "@/lib/whatsapp";
import type { Fact } from "@/lib/leads/types";
import { Spinner } from "@/components/ui";

function pretty(n: string) {
  const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${n}`;
}

/**
 * Abordagem pronta por WhatsApp. Só monta o link https://wa.me/NUMERO?text=…; abrir e
 * tocar em enviar é sempre uma ação do usuário. Sem número confirmado, o botão não aparece.
 */
export function WhatsAppPanel({
  whatsapp,
  fact,
  initialText,
  previewUrl,
  hasPreview,
  isDemo,
  busy,
  onPatch,
}: {
  whatsapp: string | null;
  fact: Fact | undefined;
  initialText: string;
  previewUrl: string | null;
  hasPreview: boolean;
  isDemo: boolean;
  busy: boolean;
  onPatch: (body: Record<string, unknown>, msg: string) => Promise<void>;
}) {
  const [text, setText] = useState(initialText);
  const [manual, setManual] = useState("");
  const [editing, setEditing] = useState(false);
  const number = whatsapp ? normalizeWhatsApp(whatsapp) : null;
  const inferred = !number && fact?.status === "inferred" && fact.value ? normalizeWhatsApp(fact.value) : null;
  const manualOk = manual ? normalizeWhatsApp(manual) : null;
  const link = useMemo(() => (number && !editing && text.trim() ? waMeLink(number, text.trim()) : null), [number, text, editing]);
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="wa-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="wa-title" className="font-semibold text-white">Abordagem por WhatsApp</h2>
          <p className="text-xs text-slate-500">Mensagem curta com fatos verificados. Nada é enviado: o botão só abre a conversa para você revisar e tocar em enviar.</p>
        </div>
        {number && <span className="badge shrink-0 bg-emerald-500/15 text-emerald-300">{pretty(number)}</span>}
      </div>

      {number && !editing ? (
        <p className="mt-3 text-xs text-slate-500">
          Número {fact?.status === "user" ? "confirmado por você" : `publicado como WhatsApp${fact?.source ? ` em ${fact.source}` : ""}`}.
          {fact?.sourceUrl ? <> <a className="hover:underline" href={fact.sourceUrl} target="_blank" rel="noopener noreferrer">Ver fonte</a></> : null}
          {" "}<button className="text-brand-300 hover:underline" onClick={() => { setManual(number); setEditing(true); }}>Corrigir número</button>
        </p>
      ) : inferred ? (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p><b>Confirme o contato.</b> O telefone {pretty(inferred)} é um celular, mas nenhuma fonte diz que ele atende no WhatsApp ou que é o canal comercial.</p>
          <button className="btn-secondary mt-3 px-3 py-2 text-sm" disabled={busy} onClick={() => onPatch({ confirmWhatsapp: true }, "WhatsApp confirmado por você")}>
            {busy ? <Spinner /> : null} Conferi: é o WhatsApp comercial
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p>{editing ? <><b>Corrigir o WhatsApp.</b> O número salvo passa a constar como “revisado por você”.</> : <><b>Nenhum WhatsApp comercial público encontrado.</b> Não vamos supor um número. Se você conferiu um (no site, perfil ou cartão da empresa), adicione abaixo.</>}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="input" inputMode="tel" placeholder="Ex.: +55 41 99999-0000" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Número de WhatsApp conferido" />
            <button className="btn-secondary shrink-0 px-3 py-2 text-sm" disabled={!manualOk || busy} onClick={() => onPatch({ fields: { whatsapp: manual } }, "WhatsApp salvo como “revisado por você”").then(() => setEditing(false))}>Salvar número</button>
          </div>
          {manual && !manualOk && <p className="mt-1 text-xs text-amber-200">Número inválido: confira o DDD e os dígitos (celular: 9 + 8 dígitos). Ex.: 55 41 99999 0000.</p>}
        </div>
      )}

      <label className="mt-5 block">
        <span className="label">Mensagem (editável)</span>
        <textarea className="input min-h-36 text-sm" maxLength={1200} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {!previewUrl && (
        <p className="mt-1 text-xs text-slate-500">
          {hasPreview ? "A prévia ainda é privada, então a mensagem oferece enviar o link. Publique a prévia para incluir o endereço." : "Ainda não há prévia gerada; a mensagem só oferece mostrar uma ideia."}
        </p>
      )}

      <p className="label mt-4">Prévia da mensagem</p>
      <div className="rounded-2xl bg-[#0b141a] p-4" aria-label="Prévia da mensagem no WhatsApp">
        <div className="ml-auto max-w-[92%] whitespace-pre-wrap break-words rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[13px] leading-relaxed text-[#e9edef] shadow">
          {text.trim() || <span className="opacity-60">(mensagem vazia)</span>}
          <span className="mt-1 block text-right text-[10px] text-[#8fb5ab]">{time}</span>
        </div>
      </div>

      {link && !isDemo ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 w-full justify-center" style={{ background: "#1fa855" }}>
          Abrir no WhatsApp para revisar
        </a>
      ) : (
        <button className="btn-primary mt-4 w-full" disabled>
          {isDemo ? "Lead fictício: contato desativado" : number ? "Escreva a mensagem" : "Adicione ou confirme o WhatsApp"}
        </button>
      )}
      <button className="btn-ghost mt-2 w-full text-sm" onClick={() => navigator.clipboard.writeText(text).then(() => {})}>Copiar texto</button>
    </section>
  );
}
