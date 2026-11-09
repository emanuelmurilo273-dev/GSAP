'use client';
import { useState } from 'react';
import { Panel, btn } from '@/components/ui';

type Any = Record<string, any>;
const F = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => <div><label>{label}</label>{children}{hint && <span className="mt-1 block text-[10px] text-dim">{hint}</span>}</div>;

export default function B3Config({ initial }: { initial: Any | null }) {
  const [v, setV] = useState<Any>(initial ?? {});
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, val: unknown) => setV({ ...v, [k]: val });
  const n = (k: string) => <input type="number" value={v[k] ?? ''} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />;
  const t = (k: string) => <input type="time" value={v[k] ?? ''} onChange={(e) => set(k, e.target.value)} />;
  const has = (s: string) => (v.symbols ?? []).includes(s);
  const toggle = (s: string) => set('symbols', has(s) ? (v.symbols as string[]).filter((x) => x !== s) : [...(v.symbols ?? []), s]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await fetch('/api/b3/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { setV({ ...v, ...j.settings }); setMsg({ ok: true, t: 'Salvo. O conector aplica em poucos segundos.' }); } else setMsg({ ok: false, t: j.error });
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <h1 className="text-lg font-semibold">Configurações do day trade</h1>
      <Panel title="ativos e risco" accent="#ff5c9a">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Ativos">
            <div className="flex gap-4 text-sm normal-case tracking-normal">
              <label className="flex items-center gap-2 normal-case tracking-normal text-ink"><input type="checkbox" className="!w-auto" checked={has('WIN')} onChange={() => toggle('WIN')} />WIN (mini índice)</label>
              <label className="flex items-center gap-2 normal-case tracking-normal text-ink"><input type="checkbox" className="!w-auto" checked={has('WDO')} onChange={() => toggle('WDO')} />WDO (mini dólar)</label>
            </div>
          </F>
          <F label="Perfil" hint="% do saldo arriscado por operação: conservador 0,5% · moderado 1% · agressivo 2%">
            <select value={v.profile} onChange={(e) => set('profile', e.target.value)}><option value="conservador">Conservador</option><option value="moderado">Moderado</option><option value="agressivo">Agressivo</option></select></F>
          <F label="Teto de perda por operação (R$)" hint="vale o MENOR entre o perfil e este teto">{n('risk_per_trade_brl')}</F>
          <F label="Máximo de contratos">{n('max_contracts')}</F>
          <F label="Stop WIN (pontos)" hint="1 ponto de WIN = R$ 0,20 por contrato">{n('stop_points_win')}</F>
          <F label="Stop WDO (pontos)" hint="1 ponto de WDO = R$ 10 por contrato">{n('stop_points_wdo')}</F>
          <F label="Alvo (múltiplo do stop)" hint="1,5 = ganha 1,5× o que arrisca">{n('rr')}</F>
          <F label="Máximo de operações por dia">{n('max_trades_per_day')}</F>
        </div>
      </Panel>
      <Panel title="limites do dia" accent="#ffa94d">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Limite de perda diária (R$)" hint="bateu, o robô zera e para até amanhã">{n('daily_loss_brl')}</F>
          <F label="Meta diária (R$) — opcional" hint="atingiu, o robô zera e para (deixe vazio para desligar)">{n('daily_target_brl')}</F>
        </div>
      </Panel>
      <Panel title="horários (Brasília)" accent="#4da3ff">
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="Começar a abrir posições" hint="a partir das 09:05 (padrão)">{t('open_from')}</F>
          <F label="Parar de abrir posições" hint="até 17:00 (padrão)">{t('open_until')}</F>
          <F label="Zerar tudo às" hint="17:30 (padrão). Confirme com a Clear o horário da zeragem compulsória e deixe o seu ANTES dele.">{t('flat_at')}</F>
        </div>
      </Panel>
      <div className="flex items-center gap-3"><button className={btn} disabled={busy}>{busy ? 'salvando…' : 'salvar'}</button>{msg && <span role="status" className={`text-sm ${msg.ok ? 'text-executor' : 'text-risk'}`}>{msg.t}</span>}</div>
    </form>
  );
}
