import { healthOf, realModeAllowed, salesOpen, strategyApproved, testnetMode } from '@desk/core';
import { Logo, Panel, Stat, dateOnly, dt, num } from '@/components/ui';
import { requireOwner } from '@/lib/auth';
import { brl, getPlanPrice } from '@/lib/price';
import AdminActions, { AccessButton } from './AdminActions';
import ValidationPanel from './ValidationPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin' };

export default async function Admin() {
  const { admin } = await requireOwner();
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const [price, subs, pays, bots, errs, off, payouts, profiles, hb, audit, errCount] = await Promise.all([
    getPlanPrice(),
    admin.from('subscriptions').select('*').order('created_at', { ascending: false }),
    admin.from('payments').select('*').order('created_at', { ascending: false }).limit(30),
    admin.from('bot_settings').select('user_id', { count: 'exact', head: true }).eq('bot_enabled', true),
    admin.from('bot_logs').select('ts,user_id,message').eq('level', 'error').gte('ts', since24).order('ts', { ascending: false }).limit(25),
    admin.from('backtests').select('*').eq('kind', 'official').order('created_at', { ascending: false }).limit(4),
    admin.from('payouts').select('*').order('created_at', { ascending: false }).limit(8),
    admin.from('profiles').select('id,email,name,role'),
    admin.from('worker_heartbeat').select('ts,info').eq('id', 1).maybeSingle(),
    admin.from('audit_log').select('*').order('ts', { ascending: false }).limit(25),
    admin.from('bot_logs').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('ts', since24),
  ]);
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [accs, sets, tr30] = await Promise.all([
    admin.from('exchange_accounts').select('user_id,exchange,last_error,last_error_at'),
    admin.from('bot_settings').select('user_id,bot_enabled,paused_reason'),
    admin.from('trades').select('user_id,pnl').eq('status', 'closed').eq('testnet', false).not('entry_order_id', 'is', null).gte('exit_at', since30),
  ]);
  const accBy = new Map((accs.data ?? []).map((a) => [a.user_id, a])); const setBy = new Map((sets.data ?? []).map((a) => [a.user_id, a]));
  const pnlBy = new Map<string, number[]>(); for (const t of tr30.data ?? []) (pnlBy.get(t.user_id) ?? pnlBy.set(t.user_id, []).get(t.user_id)!).push(Number(t.pnl));
  const prof = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  // o dono nunca aparece na lista de assinantes
  const list = (subs.data ?? []).filter((s) => prof.get(s.user_id)?.role !== 'owner');
  const active = list.filter((s) => s.status === 'active' && !s.blocked_by_admin);
  const overdue = list.filter((s) => s.status === 'overdue' || s.status === 'blocked');
  const mrr = active.reduce((a, s) => a + Number(s.value), 0);
  const hbAge = hb.data ? Math.round((Date.now() - new Date(hb.data.ts).getTime()) / 1000) : null;
  const workerOk = hbAge != null && hbAge < 180;
  const pending = (payouts.data ?? []).filter((p) => p.status === 'pending_authorization');

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-3 pb-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4"><Logo />
        <nav className="flex gap-4 text-xs font-medium uppercase tracking-widest" aria-label="Admin"><a href="/app">Dashboard do robô</a><a href="/b3">Laboratório B3</a><a href="/b3/inteligencia">Aprovar versões</a><a href="/app/backtest">Backtest</a><a href="/app/settings">Config</a><a href="/auth/signout" className="text-dim">sair</a></nav></header>
      <h1 className="text-xl font-bold tracking-tight">Admin <span className="font-mono text-sm font-normal text-risk">owner</span></h1>

      {pending.length > 0 && <div role="alert" className="rounded-lg border border-filter/50 bg-filter/10 p-3 text-sm text-filter"><b>Repasse Pix aguardando autorização no Asaas</b> ({pending.map((p) => brl(Number(p.value))).join(', ')}). Aprove no app/painel do Asaas. Novos repasses ficam em pausa até resolver.</div>}
      {!strategyApproved() && !testnetMode() && <div className="rounded-lg border border-filter/40 bg-filter/10 p-3 text-sm text-filter">Modo real <b>bloqueado para clientes</b> (STRATEGY_APPROVED=false): nenhuma estratégia passou na pesquisa. Você (dono) pode operar sua conta para validar.</div>}
      {testnetMode() && <div className="rounded-lg border border-scout/40 bg-scout/10 p-3 text-sm text-scout">BINANCE_TESTNET=true — ordens em dinheiro de mentira.</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Assinantes ativos" count={{ value: active.length, decimals: 0 }} tone="pos" />
        <Stat label="Inadimplentes/bloq." count={{ value: overdue.length, decimals: 0 }} tone={overdue.length ? 'neg' : 'neutral'} />
        <Stat label="MRR" value={brl(mrr)} />
        <Stat label="Robôs ligados" count={{ value: bots.count ?? 0, decimals: 0 }} />
        <Stat label="Erros de API (24h)" count={{ value: errCount.count ?? 0, decimals: 0 }} tone={errCount.count ? 'neg' : 'neutral'} />
        <Stat label="Worker" value={hbAge == null ? 'sem sinal' : workerOk ? 'online' : `parado ${Math.round(hbAge / 60)} min`} tone={workerOk ? 'pos' : 'neg'} sub={hb.data ? `região ${(hb.data.info as any)?.region ?? 'n/a'}` : undefined} />
      </div>

      <div className={`rounded-lg border p-3 text-sm ${salesOpen() ? 'border-executor/40 bg-executor/10 text-executor' : 'border-filter/40 bg-filter/10 text-filter'}`}>Venda: <b>{salesOpen() ? 'ABERTA' : 'FECHADA (lista de espera)'}</b> — {salesOpen() ? 'estratégia aprovada e SALES_OPEN=true.' : 'abre só com STRATEGY_APPROVED=true (teste fora da amostra aprovado) e SALES_OPEN=true.'}</div>

      <Panel title="clientes · saúde do robô de cada um (30 dias reais)" accent="#58a6ff">
        <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-sm"><thead><tr className="text-left text-xs text-dim"><th className="py-1">Cliente</th><th>Corretora</th><th>Robô</th><th>Saúde</th><th>Por operação</th><th>Conexão</th></tr></thead>
          <tbody>{list.map((x) => { const h = healthOf(pnlBy.get(x.user_id) ?? []); const a = accBy.get(x.user_id), st = setBy.get(x.user_id); const c = { verde: '#3ddc84', amarelo: '#ffcf4d', vermelho: '#ff5c6c', cinza: '#8392a1' }[h.light]; return (
            <tr key={x.user_id} className="border-t border-white/5"><td className="py-1.5">{prof.get(x.user_id)?.email ?? x.user_id.slice(0, 8)}</td><td>{a?.exchange ?? '—'}</td><td>{st?.bot_enabled ? 'ligado' : st?.paused_reason ? 'pausado (trava)' : 'desligado'}</td>
              <td><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: c }} />{h.light}</td><td className="font-mono">{h.n ? num(h.expectancy, 2) : '—'} ({h.n})</td><td className={a?.last_error ? 'text-risk' : 'text-dim'}>{a?.last_error ? String(a.last_error).slice(0, 50) : a ? 'ok' : 'sem conta'}</td></tr>); })}
            {!list.length && <tr><td colSpan={6} className="py-3 text-center text-dim">Nenhum cliente ainda.</td></tr>}</tbody></table></div>
      </Panel>

      <Panel title="validação · conta do dono (30 dias, valor pequeno)" accent="#2dd4bf"><ValidationPanel /></Panel>

      <Panel title="preço do plano" accent="#ff5c9a"><AdminActions price={price} /></Panel>

      <Panel title="assinantes" accent="#3ddc84">
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-xs"><thead className="text-left text-dim"><tr><th className="pb-2 font-medium">E-mail</th><th className="font-medium">Status</th><th className="font-medium">Valor</th><th className="font-medium">Pago até</th><th className="font-medium">Vencido desde</th><th className="font-medium">Acesso</th></tr></thead>
          <tbody>{list.map((s) => (<tr key={s.id} className="border-t border-white/[0.06]"><td className="py-2">{prof.get(s.user_id)?.email ?? s.user_id}</td><td className={s.status === 'active' ? 'text-executor' : 'text-filter'}>{s.status}</td><td>{num(+s.value)}</td><td>{s.paid_until ? dateOnly(s.paid_until) : '—'}</td><td>{s.overdue_since ? dateOnly(s.overdue_since) : '—'}</td><td><AccessButton userId={s.user_id} blocked={s.blocked_by_admin} /></td></tr>))}</tbody></table>
          {list.length === 0 && <p className="py-3 text-sm text-dim">Nenhum assinante ainda.</p>}</div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="pagamentos recentes" accent="#4da3ff"><div className="max-h-72 overflow-auto"><table className="w-full text-xs"><tbody>
          {(pays.data ?? []).map((p) => <tr key={p.asaas_payment_id} className="border-t border-white/[0.06]"><td className="py-1.5">{p.email}</td><td>R$ {num(+p.value)}</td><td>{p.billing_type}</td><td className={p.status === 'RECEIVED' || p.status === 'CONFIRMED' ? 'text-executor' : 'text-filter'}>{p.status}</td></tr>)}</tbody></table>
          {!pays.data?.length && <p className="text-sm text-dim">Sem pagamentos.</p>}</div></Panel>
        <Panel title="erros de API · 24h" accent="#ff5c9a"><div className="max-h-72 space-y-1 overflow-auto font-mono text-[11px]">
          {(errs.data ?? []).length === 0 && <p className="text-dim">Sem erros.</p>}
          {(errs.data ?? []).map((e, i) => <div key={i}><span className="text-dim">{dt(e.ts)} {prof.get(e.user_id)?.email ?? ''}</span> <span className="text-risk">{e.message}</span></div>)}</div></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="backtest oficial (estratégia padrão)" accent="#a478ff">
          <div className="space-y-1 font-mono text-[11px]">
            {(off.data ?? []).map((b) => <p key={b.id}>{b.symbol} · {b.days}d · {dateOnly(b.created_at)} → {(b.metrics.totalPnlPct * 100).toFixed(1)}% · acerto {b.metrics.winRate == null ? '—' : (b.metrics.winRate * 100).toFixed(0) + '%'} · DD -{(b.metrics.maxDrawdownPct * 100).toFixed(1)}% · {b.metrics.trades} trades</p>)}
            {!off.data?.length && <p className="text-dim">Ainda não executado (roda toda segunda no worker).</p>}</div>
          <div className="mt-3"><AdminActions official /></div>
        </Panel>
        <Panel title="repasses para a chave Pix" accent="#ffa94d"><div className="space-y-1 font-mono text-[11px]">
          {(payouts.data ?? []).map((p) => <p key={p.id}>{dt(p.created_at)} · R$ {num(+p.value)} · <span className={p.status === 'ok' ? 'text-executor' : p.status === 'pending_authorization' ? 'text-filter' : 'text-risk'}>{p.status}</span> {p.detail}</p>)}
          {!payouts.data?.length && <p className="text-dim">Nenhum repasse ainda.</p>}</div></Panel>
      </div>

      <Panel title="log de auditoria · logins do dono e ações no admin" accent="#8392a1"><div className="max-h-72 overflow-auto"><table className="w-full min-w-[520px] text-xs"><tbody>
        {(audit.data ?? []).map((a) => <tr key={a.id} className="border-t border-white/[0.06]"><td className="py-1.5 text-dim">{dt(a.ts)}</td><td>{a.action}</td><td className="text-dim">{a.email}</td><td className="font-mono text-[10px] text-dim">{a.ip}</td><td className="font-mono text-[10px] text-dim">{JSON.stringify(a.detail)}</td></tr>)}</tbody></table>
        {!audit.data?.length && <p className="text-sm text-dim">Sem registros.</p>}</div></Panel>
      <p className="text-[11px] text-dim">Modo real permitido para clientes agora? <b>{realModeAllowed(false) ? 'sim' : 'não'}</b> · mercado: <b>{process.env.ENABLE_MERCADO_BITCOIN === 'true' ? 'on' : 'off'}</b></p>
    </main>
  );
}
