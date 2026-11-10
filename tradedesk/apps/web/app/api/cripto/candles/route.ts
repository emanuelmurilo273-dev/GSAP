import { makeExchange } from '@desk/core';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYMS = new Set(['BTC/BRL', 'ETH/BRL', 'SOL/BRL']);
const TFS = new Set(['1m', '5m', '15m']);

/** Histórico recente de candles da Foxbit (dados públicos reais). O gráfico completa o candle em formação com o WebSocket oficial. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const symbol = u.searchParams.get('symbol') ?? 'BTC/BRL', tf = u.searchParams.get('tf') ?? '1m';
  if (!SYMS.has(symbol) || !TFS.has(tf)) return NextResponse.json({ error: 'parâmetros inválidos' }, { status: 400 });
  try {
    const ex = makeExchange('foxbit');
    const rows = (await ex.fetchOHLCV(symbol, tf, undefined, 300)) as number[][];
    return NextResponse.json({ candles: rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] })), at: Date.now() }, { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: `Foxbit indisponível: ${String(e?.message ?? e).slice(0, 120)}` }, { status: 502 });
  }
}
