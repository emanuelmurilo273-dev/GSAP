'use client';
import { DEFAULT_PARAMS, type StrategyParams } from '@desk/core/types';

/** Estado do formulário em PERCENTUAL (3 = 3%); o servidor recebe frações. */
export type PForm = { minScore: number; stopPct: number; targetPct: number; trailingPct: number; positionPct: number; dailyLossPct: number; maxPositions: number; timeframe: string };

export const toForm = (p: StrategyParams): PForm => ({
  minScore: p.minScore, stopPct: p.stopPct * 100, targetPct: p.targetPct * 100, trailingPct: p.trailingPct * 100,
  positionPct: p.positionPct * 100, dailyLossPct: p.dailyLossPct * 100, maxPositions: p.maxPositions, timeframe: p.timeframe,
});
export const fromForm = (f: PForm) => ({
  minScore: f.minScore, stopPct: f.stopPct / 100, targetPct: f.targetPct / 100, trailingPct: f.trailingPct / 100,
  positionPct: f.positionPct / 100, dailyLossPct: f.dailyLossPct / 100, maxPositions: f.maxPositions, timeframe: f.timeframe,
});
export const defaultForm = () => toForm(DEFAULT_PARAMS);

const FIELDS: [keyof PForm, string, number, string?][] = [
  ['positionPct', '% do saldo por trade (máx.)', 0.5, '5 = 5%'],
  ['stopPct', 'Stop loss (%)', 0.1],
  ['targetPct', 'Alvo (%)', 0.1],
  ['trailingPct', 'Trailing (%) · 0 desliga', 0.1],
  ['dailyLossPct', 'Limite de perda diária (%)', 0.5],
  ['minScore', 'Nota mínima do Analyst (0–1)', 0.01],
  ['maxPositions', 'Posições simultâneas', 1],
];

export default function ParamFields({ v, set, only }: { v: PForm; set: (v: PForm) => void; only?: (keyof PForm)[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {FIELDS.filter(([k]) => !only || only.includes(k)).map(([k, label, step, hint]) => (
        <div key={k}><label>{label}</label>
          <input type="number" step={step} value={v[k] as number} onChange={(e) => set({ ...v, [k]: Number(e.target.value) })} />
          {hint && <span className="text-[10px] text-dim">{hint}</span>}</div>
      ))}
      <div><label>Timeframe</label>
        <select value={v.timeframe} onChange={(e) => set({ ...v, timeframe: e.target.value })}>
          <option value="15m">15 minutos</option><option value="1h">1 hora</option><option value="4h">4 horas</option></select></div>
    </div>
  );
}
