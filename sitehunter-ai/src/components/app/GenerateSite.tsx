"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner } from "@/components/ui";

export type SegmentOption = { key: string; label: string };

export function GenerateSiteDialog({ companyId, companyName, segments, defaultSegment, onClose }: { companyId: string; companyName: string; segments: SegmentOption[]; defaultSegment?: string; onClose: () => void }) {
  const [segment, setSegment] = useState(defaultSegment ?? segments[0]?.key ?? "servicos");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ project: { id: string } }>("/api/projects", { body: { companyId, segment, instructions: instructions || undefined } });
      location.href = `/app/sites/${r.project.id}`;
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="card relative w-full max-w-lg p-6 animate-fade-up">
        <h2 className="text-lg font-semibold text-white">Criar site com IA</h2>
        <p className="mt-1 text-sm text-slate-400">{companyName}</p>
        <div className="mt-5 space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Modelo / segmento">
            <select className="input" value={segment} onChange={(e) => setSegment(e.target.value)}>
              {segments.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Preferências (opcional)" hint="Ex.: tom mais descontraído, destacar atendimento infantil. Não informe fatos que não tenham sido confirmados.">
            <textarea className="input min-h-20" maxLength={800} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-500">Usa 1 geração do seu limite mensal. A IA usa somente os dados públicos da empresa e não inventa depoimentos, avaliações ou preços.</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn-primary" onClick={generate} disabled={loading}>{loading ? <><Spinner /> Gerando site...</> : "Gerar site"}</button>
        </div>
      </div>
    </div>
  );
}
