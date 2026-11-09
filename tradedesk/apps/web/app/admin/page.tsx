import { dt, dateOnly, Logo, num, Panel, Stat } from '@/components/ui';
import { requireOwner } from '@/lib/auth';
import { brl, getPlanPrice } from '@/lib/price';
import AdminActions, { AccessButton } from './AdminActions';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const { admin } = await requireOwner();
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const [price, subs, pays, bots, errs, off, payouts, profiles] = await Promise.all([
    getPlanPrice(),
    admin.from('subscriptions').select('*').order('created_at', { ascending: false }),
    admin.from('payments').select('*').order('created_at', { ascending: false }).limit(30),
    admin.from('bot_settings').select('user_id', { count: 'exact', head: true }).eq('bot_enabled', true),
    admin.from('bot_logs').select('ts,user_id,message').eq('level', 'error').gte('ts', since24).order('ts', { ascending: false }).limit(25),
    admin.from('backtests').select('*').eq('kind', 'official').order('created_at', { ascending: false }).limit(4),
    admin.from('payouts').select('*').order('created_at', { ascending: false }).limit(5),
    admin.from('profiles').select('id,email,name'),
  ]);
  const email = new Map((profiles.data ?? []).map((p) => [p.id, p.email]));
  const list = subs.data ?? [];
  const active = list.filter((s) => s.status === 'active' && !s.blocked_by_admin);
  const overdue = list.filter((s) => s.status === 'overdue' || s.status === 'blocked');
  const mrr = active.reduce((a, s) => a + Number(s.value), 0);
  const { count: errCount } = await admin.from('bot_logs').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('ts', since24);

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-3 pb-10">
      <header className="flex items-center justify-between py-4"><Logo /><a href="/app" className="text-xs uppercase tracking-widest">← painel</a></header>
      <h1 className="text-lg text-neon-orange">&gt; admin · owner</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Assinantes ativos" value={active.length} tone="pos" />
        <Stat label="Inadimplentes/bloq." value={overdue.length} tone={overdue.length ? 'neg' : 'neutral'} />
        <Stat label="MRR" value={brl(mrr)} />
        <Stat label="Robôs ligados" value={bots.count ?? 0} />
        <Stat label="Erros de API (24h)" value={errCount ?? 0} tone={errCount ? 'neg' : 'neutral'} />
      </div>

      <Panel title="preço do plano" accent="#ff4fa3"><AdminActions price={price} /></Panel>

      <Panel title="assinantes" accent="#39ff88">
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-xs"><thead className="text-left text-dim"><tr><th>E-mail</th><th>Status</th><th>Valor</th><th>Pago até</th><th>Vencido desde</th><th>Acesso</th></tr></thead>
          <tbody>{list.map((s) => (<tr key={s.id} className="border-t border-line"><td className="py-1">{email.get(s.user_id) ?? s.user_id}</td><td className={s.status === 'active' ? 'text-neon-green' : 'text-neon-orange'}>{s.status}</td><td>{num(+s.value)}</td><td>{s.paid_until ? dateOnly(s.paid_until) : '—'}</td><td>{s.overdue_since ? dateOnly(s.overdue_since) : '—'}</td><td><AccessButton userId={s.user_id} blocked={s.blocked_by_admin} /></td></tr>))}</tbody></table></div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="pagamentos recentes" accent="#3aa8ff"><div className="max-h-72 overflow-auto"><table className="w-full text-xs"><tbody>
          {(pays.data ?? []).map((p) => <tr key={p.asaas_payment_id} className="border-t border-line"><td className="py-1">{p.email}</td><td>R$ {num(+p.value)}</td><td>{p.billing_type}</td><td className={p.status === 'RECEIVED' || p.status === 'CONFIRMED' ? 'text-neon-green' : 'text-neon-orange'}>{p.status}</td></tr>)}</tbody></table></div></Panel>
        <Panel title="erros de API · 24h" accent="#ff4fa3"><div className="max-h-72 space-y-1 overflow-auto text-[11px]">
          {(errs.data ?? []).length === 0 && <p className="text-dim">Sem erros.</p>}
          {(errs.data ?? []).map((e, i) => <div key={i}><span className="text-dim">{dt(e.ts)} {email.get(e.user_id) ?? ''}</span> <span className="text-neon-pink">{e.message}</span></div>)}</div></Panel>
      </div>

      <Panel title="backtest oficial (estratégia padrão)" accent="#a66bff">
        <div className="space-y-1 text-xs">
          {(off.data ?? []).map((b) => <p key={b.id}>{b.symbol} · {b.days}d · {dateOnly(b.created_at)} → resultado {(b.metrics.totalPnlPct * 100).toFixed(1)}% · acerto {b.metrics.winRate == null ? '—' : (b.metrics.winRate * 100).toFixed(0) + '%'} · DD -{(b.metrics.maxDrawdownPct * 100).toFixed(1)}% · {b.metrics.trades} trades</p>)}
          {!off.data?.length && <p className="text-dim">Ainda não executado (roda toda segunda-feira no worker).</p>}
        </div>
        <div className="mt-3"><AdminActions official /></div>
      </Panel>

      <Panel title="repasses para a chave Pix" accent="#ffa21f"><div className="space-y-1 text-xs">
        {(payouts.data ?? []).map((p) => <p key={p.id}>{dt(p.created_at)} · R$ {num(+p.value)} · <span className={p.status === 'ok' ? 'text-neon-green' : 'text-neon-pink'}>{p.status}</span> {p.detail}</p>)}
        {!payouts.data?.length && <p className="text-dim">Nenhum repasse ainda.</p>}</div></Panel>
    </main>
  );
}
