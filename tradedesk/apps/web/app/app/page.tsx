import { realModeAllowed, testnetMode } from '@desk/core';
import { requireSubscriber } from '@/lib/auth';
import Dashboard from './Dashboard';

export default async function Page() {
  const { user, admin, isOwner } = await requireSubscriber();
  const now = Date.now();
  const brtStart = (d: number) => new Date(Math.floor((d - 3 * 3600_000) / 86_400_000) * 86_400_000 + 3 * 3600_000).toISOString();
  const dayStart = brtStart(now);
  const [s, acc, open, closed, logs, agents, snaps] = await Promise.all([
    admin.from('bot_settings').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('exchange_accounts').select('exchange,key_hint,verified,last_error').eq('user_id', user.id).maybeSingle(),
    admin.from('trades').select('*').eq('user_id', user.id).eq('status', 'open').order('entry_at', { ascending: false }),
    admin.from('trades').select('*').eq('user_id', user.id).eq('status', 'closed').order('exit_at', { ascending: false }).limit(60),
    admin.from('bot_logs').select('id,ts,agent,level,message').eq('user_id', user.id).order('ts', { ascending: false }).limit(60),
    admin.from('agent_status').select('*').eq('user_id', user.id),
    admin.from('equity_snapshots').select('ts,equity').eq('user_id', user.id).order('ts', { ascending: false }).limit(600),
  ]);
  // P&L realizado por período (fechamentos reais registrados a partir das ordens da corretora)
  const since = (d: number) => new Date(now - d * 86_400_000).toISOString();
  const { data: month } = await admin.from('trades').select('pnl,exit_at').eq('user_id', user.id).eq('status', 'closed').gte('exit_at', since(30));
  const sum = (from: string) => (month ?? []).filter((t) => t.exit_at! >= from).reduce((a, t) => a + Number(t.pnl ?? 0), 0);
  return (
    <Dashboard
      userId={user.id}
      realBlocked={!realModeAllowed(isOwner)}
      testnet={testnetMode()}
      settings={s.data}
      account={acc.data}
      initial={{ open: open.data ?? [], closed: closed.data ?? [], logs: logs.data ?? [], agents: agents.data ?? [] }}
      equity={(snaps.data ?? []).reverse().map((r) => ({ t: new Date(r.ts).getTime(), v: Number(r.equity) }))}
      pnl={{ day: sum(dayStart), week: sum(since(7)), month: sum(since(30)) }}
    />
  );
}
