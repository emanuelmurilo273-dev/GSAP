"use client";
import { useMemo, useState } from "react";
import { buildFlowPrompt, FLOW_URL, type FlowPurpose } from "@/lib/flow";
import type { SiteImage } from "@/lib/site/types";
import { toast } from "@/components/ui";

/**
 * Fluxo assistido do Google Flow: não existe API pública, então o sistema só
 * prepara o prompt. A geração acontece no Flow, pelo usuário; o resultado é
 * revisado e importado aqui, marcado como "gerada por IA".
 */
export function FlowAssistant({ segmentLabel, niche, palette, onInsert, onClose }: { segmentLabel: string; niche?: string | null; palette?: { primary: string; accent: string }; onInsert: (i: SiteImage) => void; onClose: () => void }) {
  const [purpose, setPurpose] = useState<FlowPurpose>("hero");
  const [style, setStyle] = useState("");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const pack = useMemo(() => buildFlowPrompt({ segmentLabel, niche, palette, purpose, style: style || undefined }), [segmentLabel, niche, palette, purpose, style]);
  const [checks, setChecks] = useState<boolean[]>(pack.checklist.map(() => false));
  const validUrl = /^https:\/\/\S+$/i.test(url);
  const ready = validUrl && alt.trim().length >= 3 && checks.every(Boolean);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="flow-title" className="card relative max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6 animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="flow-title" className="text-lg font-semibold text-white">Assistente Google Flow</h2>
            <p className="mt-1 text-sm text-slate-400">O Google Flow não oferece API pública. Aqui você prepara o prompt, gera a imagem no Flow, revisa e importa o resultado. Nada é gerado automaticamente.</p>
          </div>
          <button className="btn-ghost px-2" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <ol className="mt-5 space-y-5 text-sm">
          <li>
            <p className="font-semibold text-white">1. Prepare o prompt</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value as FlowPurpose)} aria-label="Uso da imagem">
                <option value="hero">Capa (16:9)</option>
                <option value="gallery">Galeria (4:3)</option>
                <option value="service">Serviço (1:1)</option>
                <option value="ambience">Ambiente (1:1)</option>
              </select>
              <input className="input" placeholder="Estilo (opcional): ex. luz natural, tons quentes" maxLength={120} value={style} onChange={(e) => setStyle(e.target.value)} />
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-white/10 bg-ink-950 p-3 text-xs text-slate-300">{pack.prompt}</pre>
            <p className="mt-2 text-xs text-slate-500">Evitar: {pack.negative} · Proporção {pack.aspect}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-secondary px-3 py-2 text-xs" onClick={async () => { await navigator.clipboard.writeText(`${pack.prompt}\n\nAvoid: ${pack.negative}\nAspect ratio: ${pack.aspect}`); toast("Prompt copiado"); }}>Copiar prompt</button>
              <a className="btn-secondary px-3 py-2 text-xs" href={FLOW_URL} target="_blank" rel="noopener noreferrer">Abrir o Google Flow ↗</a>
            </div>
          </li>
          <li>
            <p className="font-semibold text-white">2. Importe o resultado</p>
            <p className="mt-1 text-xs text-slate-500">Hospede a imagem gerada em um endereço HTTPS seu (o envio de arquivos para a plataforma ainda não está disponível) e cole a URL.</p>
            <div className="mt-2 grid gap-3">
              <input className="input" placeholder="https://…/imagem.jpg" value={url} onChange={(e) => setUrl(e.target.value.trim())} aria-label="URL da imagem gerada" />
              <input className="input" placeholder="Texto alternativo (descreva a imagem)" maxLength={200} value={alt} onChange={(e) => setAlt(e.target.value)} aria-label="Texto alternativo" />
              {validUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={alt || "Pré-visualização da imagem importada"} className="max-h-48 w-full rounded-xl object-cover" referrerPolicy="no-referrer" />
              )}
            </div>
          </li>
          <li>
            <p className="font-semibold text-white">3. Revise antes de incluir</p>
            <div className="mt-2 space-y-2">
              {pack.checklist.map((c, i) => (
                <label key={c} className="flex items-start gap-2 text-slate-300">
                  <input type="checkbox" className="mt-1 accent-[var(--color-signal)]" checked={checks[i] ?? false} onChange={(e) => setChecks((x) => x.map((v, j) => (j === i ? e.target.checked : v)))} />
                  {c}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">{pack.disclosure}</p>
          </li>
        </ol>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary"
            disabled={!ready}
            onClick={() => {
              onInsert({ url, alt: alt.trim(), origin: "generated", generator: "Google Flow", license: "Gerada pelo usuário no Google Flow. Uso conforme os termos do plano Google utilizado." });
              onClose();
            }}
          >
            Inserir como imagem gerada
          </button>
        </div>
      </div>
    </div>
  );
}
