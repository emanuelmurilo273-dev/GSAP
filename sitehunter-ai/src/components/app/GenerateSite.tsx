"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Alert, Field, Spinner } from "@/components/ui";

export type SegmentOption = { key: string; label: string };

type ResearchResult = { research: { sources: unknown[]; photos: unknown[]; services: unknown[]; needsConfirmation: string[] }; reviews: { items: unknown[] } | null };

export function GenerateSiteDialog({ companyId, companyName, segments, defaultSegment, researchedAt, onClose }: { companyId: string; companyName: string; segments: SegmentOption[]; defaultSegment?: string; researchedAt?: string | null; onClose: () => void }) {
  const [research, setResearch] = useState(!researchedAt);
  const [stage, setStage] = useState<"" | "research" | "generate">("");
  const [found, setFound] = useState<string | null>(null);
  const [segment, setSegment] = useState(defaultSegment ?? segments[0]?.key ?? "servicos");
  const [instructions, setInstructions] = useState("");
  const [menuText, setMenuText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function generate() {
    setLoading(true);
    setError(null);
    let phase = "";
    try {
      if (research && !found) {
        phase = "research";
        setStage("research");
        const r = await api<ResearchResult>(`/api/companies/${companyId}/research`, { method: "POST" });
        setFound(`Pesquisa concluída: ${r.research.sources.length} fonte(s), ${r.research.services.length} serviço(s) confirmado(s), ${r.research.photos.length} foto(s) oficial(is), ${r.reviews?.items.length ?? 0} avaliação(ões) do Google, ${r.research.needsConfirmation.length} item(ns) a confirmar.`);
      }
      phase = "generate";
      setStage("generate");
      const r = await api<{ project: { id: string } }>("/api/projects", { body: { companyId, segment, instructions: instructions || undefined, menuText: menuText || undefined } });
      location.href = `/app/sites/${r.project.id}`;
    } catch (e) {
      setError((e as Error).message + (phase === "research" ? " Você pode desmarcar a pesquisa e gerar só com os dados do Google." : ""));
      setStage("");
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
          <Field label="Cardápio ou tabela de preços (opcional)" hint="Cole o cardápio real (iFood, foto transcrita, site antigo). A IA organiza com os preços exatos.">
            <textarea className="input min-h-20" maxLength={6000} value={menuText} onChange={(e) => setMenuText(e.target.value)} />
          </Field>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            <input type="checkbox" className="mt-1" checked={research} disabled={loading} onChange={(e) => setResearch(e.target.checked)} />
            <span>
              <b className="text-white">Pesquisar a empresa na web antes</b> {researchedAt ? `(última pesquisa em ${new Date(researchedAt).toLocaleDateString("pt-BR")})` : "(recomendado)"}
              <span className="mt-1 block text-xs text-slate-400">Procura o site e os perfis oficiais para confirmar serviços, contatos, horários, cores da marca e fotos próprias. Só entra no site o que tiver fonte; o resto fica marcado como "a confirmar". Avaliações vêm do Google com autor e link. Usa 1 geração a mais e pode levar até 2 minutos.</span>
            </span>
          </label>
          {found && <p className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-300" role="status">{found}</p>}
          <p className="text-xs text-slate-500">Usa 1 geração do seu limite mensal. A IA usa somente os dados públicos da empresa e não inventa depoimentos, avaliações ou preços.</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn-primary" onClick={generate} disabled={loading}>{loading ? <><Spinner /> {stage === "research" ? "Pesquisando a empresa..." : "Gerando site..."}</> : "Gerar site"}</button>
        </div>
      </div>
    </div>
  );
}
