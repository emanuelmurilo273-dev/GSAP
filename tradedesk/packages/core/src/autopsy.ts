import { computeStats, dayKey, type StatTrade } from './stats';

/** AUTÓPSIA do robô de cripto (pura e testada): expectativa, custos, recortes, 20 piores, integridade e veredito. Só operações REAIS com ID de ordem. */
export interface CryptoRow {
  id: string; symbol: string; entry_at: string; exit_at: string | null; qty: number; entry_price: number; exit_price: number | null; cost: number;
  proceeds: number | null; pnl: number | null; fees?: number | null; exit_reason: string | null; score: number | null; analysis: string | null;
  stop_price: number; target_price: number; stop_order_id?: string | null; entry_order_id?: string | null; exit_order_id?: string | null; status: string; testnet?: boolean;
}

const mean = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);
const sd = (x: number[]) => (x.length > 1 ? Math.sqrt(x.reduce((a, b) => a + (b - mean(x)) ** 2, 0) / (x.length - 1)) : 0);
export const brl = (v: number | null | undefined, s = false) => (v == null ? '—' : `${s && v > 0 ? '+' : v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const TZ = 'America/Sao_Paulo';
const hourOf = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(iso));
const dowOf = (iso: string) => DOW[new Date(new Date(iso).toLocaleString('en-US', { timeZone: TZ })).getDay()];

export function exitKind(r: CryptoRow): string {
  const t = String(r.exit_reason ?? '').toLowerCase();
  if (/emerg/.test(t)) return 'emergência'; if (/sem stop/.test(t)) return 'sem stop protetor'; if (/trailing/.test(t)) return 'trailing stop';
  if (/alvo/.test(t)) return 'alvo'; if (/stop/.test(t)) return 'stop'; if (/manual|fechamento/.test(t)) return 'fechamento manual';
  return t || 'outro';
}

export function verdict(pnls: number[]) {
  const k = Math.floor(pnls.length * 0.7), oos = pnls.slice(k), m = mean(oos), h = oos.length > 1 ? 1.96 * sd(oos) / Math.sqrt(oos.length) : 0;
  if (oos.length < 100) return { status: 'SEM PROVA', text: `só ${oos.length} operações fora da amostra (precisa de ≥ 100): não dá para afirmar vantagem.`, oosN: oos.length, oosMean: m };
  if (m <= 0) return { status: 'SEM VANTAGEM', text: 'a expectativa fora da amostra é zero ou negativa: o robô não tem vantagem.', oosN: oos.length, oosMean: m };
  return m - h > 0 ? { status: 'COM VANTAGEM', text: 'expectativa fora da amostra positiva e acima da margem de erro.', oosN: oos.length, oosMean: m } : { status: 'SEM PROVA', text: 'positiva, mas dentro da margem de erro (pode ser sorte).', oosN: oos.length, oosMean: m };
}

/** Auditoria de execução: ordem duplicada, stop ausente, posição esquecida, mão maior que a configurada, saída sem ID, estouro de operações por dia. */
export function integrity(rows: CryptoRow[], o: { positionPct?: number; maxTradesPerDay?: number; equityAt?: (iso: string) => number | null; now?: Date } = {}): { ok: boolean; msg: string }[] {
  const out: { ok: boolean; msg: string }[] = [];
  const ids = new Map<string, number>(); for (const r of rows) if (r.entry_order_id) ids.set(r.entry_order_id, (ids.get(r.entry_order_id) ?? 0) + 1);
  const dup = [...ids].filter(([, n]) => n > 1);
  out.push({ ok: !dup.length, msg: dup.length ? `ordens de entrada duplicadas: ${dup.slice(0, 3).map(([i]) => i).join(', ')}` : 'nenhuma ordem de entrada duplicada' });
  const noId = rows.filter((r) => !r.entry_order_id);
  out.push({ ok: !noId.length, msg: noId.length ? `${noId.length} operação(ões) SEM ID de ordem de entrada (não entram nas estatísticas)` : 'toda operação tem ID de ordem' });
  const open = rows.filter((r) => r.status === 'open'), now = (o.now ?? new Date()).getTime();
  const old = open.filter((r) => now - new Date(r.entry_at).getTime() > 72 * 3600_000);
  out.push({ ok: !old.length, msg: old.length ? `${old.length} posição(ões) aberta(s) há mais de 72 h (esquecida?)` : 'nenhuma posição esquecida' });
  const noStop = open.filter((r) => !r.stop_order_id);
  out.push({ ok: !noStop.length, msg: noStop.length ? `${noStop.length} posição(ões) aberta(s) SEM stop na corretora (só o worker protege)` : 'toda posição aberta tem stop na corretora' });
  const closed = rows.filter((r) => r.status === 'closed');
  const noExit = closed.filter((r) => !r.exit_order_id && !/stop/.test(String(r.exit_reason)));
  out.push({ ok: !noExit.length, msg: noExit.length ? `${noExit.length} saída(s) sem ID de ordem` : 'toda saída tem ID de ordem (ou foi o stop da corretora)' });
  if (o.positionPct && o.equityAt) {
    const big = rows.filter((r) => { const eq = o.equityAt!(r.entry_at); return eq != null && eq > 0 && r.cost > eq * o.positionPct! * 1.15; });
    out.push({ ok: !big.length, msg: big.length ? `${big.length} operação(ões) com mão maior que a configurada (${(o.positionPct * 100).toFixed(0)}% da conta)` : 'mão nunca passou da configurada' });
  }
  const byDay = new Map<string, number>(); for (const r of rows) byDay.set(dayKey(r.entry_at), (byDay.get(dayKey(r.entry_at)) ?? 0) + 1);
  if (o.maxTradesPerDay) { const over = [...byDay].filter(([, n]) => n > o.maxTradesPerDay!); out.push({ ok: !over.length, msg: over.length ? `${over.length} dia(s) acima de ${o.maxTradesPerDay} operações (ex.: ${over[0][0]}: ${over[0][1]})` : `nenhum dia acima de ${o.maxTradesPerDay} operações` }); }
  const stopBad = closed.filter((r) => /stop/.test(exitKind(r)) && r.exit_price != null && r.exit_price < r.stop_price * 0.99);
  out.push({ ok: !stopBad.length, msg: stopBad.length ? `${stopBad.length} stop(s) saíram mais de 1% abaixo do preço de stop (derrapagem grande)` : 'nenhum stop com derrapagem acima de 1%' });
  return out;
}

export function cryptoAutopsy(all: CryptoRow[], o: Parameters<typeof integrity>[1] = {}): string {
  const real = all.filter((r) => r.testnet !== true);
  const closed = real.filter((r) => r.status === 'closed' && r.pnl != null && r.entry_order_id);
  const st: StatTrade[] = closed.map((r) => ({ id: r.id, market: 'cripto', symbol: r.symbol, side: 'buy', openedAt: r.entry_at, closedAt: r.exit_at!, pnl: Number(r.pnl), fees: Number(r.fees ?? 0), orderId: r.entry_order_id }));
  const s = computeStats(st);
  const L: string[] = ['## Cripto — autópsia das operações REAIS (com ID de ordem)', ''];
  if (!s.n) return L.concat(['Nenhuma operação real fechada com ID de ordem. Nada a analisar (e nada foi inventado).']).join('\n');
  const w = closed.filter((r) => r.pnl! > 0), l = closed.filter((r) => r.pnl! < 0);
  L.push(`**${s.n} operações, de ${new Date(s.firstTradeAt!).toLocaleDateString('pt-BR')} até hoje.**`, '', '### Expectativa por operação', '');
  L.push(`\`expectativa = %acerto × ganho médio − %erro × perda média\` = ${(s.winRate! * 100).toFixed(1)}% × ${brl(s.avgWin)} − ${((1 - s.winRate!) * 100).toFixed(1)}% × ${brl(s.avgLoss)} = **${brl(s.expectancy, true)} por operação** · fator de lucro ${s.profitFactor == null ? '—' : s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)} · resultado líquido **${brl(s.net, true)}**.`, '');
  if ((s.expectancy ?? 0) <= 0) L.push('> ⚠️ **Expectativa NEGATIVA: o robô não tem vantagem neste conjunto.**', '');
  const sl = closed.filter((r) => exitKind(r).includes('stop') && r.exit_price != null && r.stop_price > 0);
  const slip = sl.reduce((a, r) => a + Math.max(0, (r.stop_price - r.exit_price!) * r.qty), 0);
  L.push('### Custos', '', `Taxas pagas: **${brl(-s.costs)}** · derrapagem medida nos stops: **${brl(-slip)}** · resultado antes de taxas e derrapagem: **${brl(s.net + s.costs + slip, true)}**.`);
  const gross = s.net + s.costs + slip; L.push(gross >= 0 && s.net < 0 ? '**Os custos sozinhos explicam o prejuízo.**' : s.net < 0 ? `Os custos agravam (${brl(-(s.costs + slip))}), mas **não explicam sozinhos**: sem eles o resultado já era ${brl(gross, true)}.` : '', '');
  const tab = (title: string, g: { key: string; n: number; winRate: number; expectancy: number; pnl: number }[]) => [`### ${title}`, '', '| | ops | acerto | por operação | resultado |', '|---|---|---|---|---|', ...g.map((x) => `| ${x.key} | ${x.n} | ${Math.round(x.winRate * 100)}% | ${brl(x.expectancy, true)} | ${brl(x.pnl, true)} |`), ''];
  const grp = (f: (r: CryptoRow) => string) => { const m = new Map<string, CryptoRow[]>(); for (const r of closed) (m.get(f(r)) ?? m.set(f(r), []).get(f(r))!).push(r); return [...m].map(([key, g]) => ({ key, n: g.length, winRate: g.filter((r) => r.pnl! > 0).length / g.length, expectancy: mean(g.map((r) => r.pnl!)), pnl: g.reduce((a, r) => a + r.pnl!, 0) })).sort((a, b) => a.key.localeCompare(b.key)); };
  L.push(...tab('Por ativo', grp((r) => r.symbol)), ...tab('Por horário (Brasília)', grp((r) => `${hourOf(r.entry_at)}h`)), ...tab('Por dia da semana', grp((r) => dowOf(r.entry_at))),
    ...tab('Por lado', grp(() => 'compra (o robô só compra)')), ...tab('Por motivo de saída', grp(exitKind)),
    ...tab('Por setup (nota do Analyst)', grp((r) => (r.score == null ? 'sem nota' : r.score >= 0.85 ? 'nota ≥ 0,85' : r.score >= 0.75 ? 'nota 0,75–0,85' : 'nota 0,70–0,75'))));
  L.push('_O regime de mercado não é gravado nas operações de cripto; a nota do Analyst (acima) é o recorte de qualidade disponível. Recortes com menos de 30 operações são ruído: não corte nada por eles._', '');
  L.push('### As 20 piores operações', '', '| # | entrada | ativo | resultado | saída | por que entrou | o que deveria ter acontecido |', '|---|---|---|---|---|---|---|');
  [...closed].sort((a, b) => a.pnl! - b.pnl!).slice(0, 20).forEach((r, i) => {
    const les: string[] = []; const k = exitKind(r);
    if (k === 'stop' || k === 'trailing stop') les.push(`stop de ${(((r.entry_price - r.stop_price) / r.entry_price) * 100).toFixed(1)}%: o preço andou contra e não voltou`);
    if (r.score != null && r.score < 0.75) les.push(`nota baixa (${r.score}): sinal fraco, perto do mínimo`);
    if (Number(r.fees ?? 0) > Math.abs(r.pnl!) * 0.25) les.push(`taxas de ${brl(Number(r.fees))} pesaram`);
    L.push(`| ${i + 1} | ${new Date(r.entry_at).toLocaleString('pt-BR', { timeZone: TZ })} | ${r.symbol} | ${brl(r.pnl, true)} | ${k} | ${String(r.analysis ?? '—').replace(/\|/g, '/').slice(0, 110)} | ${les.join('; ') || 'perda dentro do risco previsto; sem erro evidente'} |`);
  });
  L.push('', '### Auditoria de execução (bugs)', '', ...integrity(real, o).map((x) => `- ${x.ok ? '✅' : '🚨'} ${x.msg}`), '');
  const v = verdict(closed.map((r) => r.pnl!));
  L.push('### Veredito', '', `**${v.status}** — ${v.text}`, '', `> **${v.status === 'COM VANTAGEM' ? 'O robô tem vantagem neste conjunto.' : 'O robô não tem vantagem comprovada.'}**`);
  void w; void l;
  return L.join('\n');
}
