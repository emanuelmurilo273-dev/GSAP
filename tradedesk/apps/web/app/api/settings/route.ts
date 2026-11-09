import { NextResponse } from 'next/server';
import { apiSubscriber } from '@/lib/auth';
import { cleanParams } from '@/lib/params';

export async function PUT(req: Request) {
  const g = await apiSubscriber();
  if (!g.ok) return g.res;
  const { userId, admin } = g.data;
  const b = await req.json().catch(() => ({}));
  const p = cleanParams(b);
  const bases = (Array.isArray(b.bases) ? b.bases : []).map((x: unknown) => String(x).toUpperCase().trim()).filter((x: string) => /^[A-Z0-9]{2,10}$/.test(x)).slice(0, 12);
  if (!bases.length) return NextResponse.json({ error: 'escolha ao menos um par' }, { status: 400 });
  const quote = b.quote === 'BRL' ? 'BRL' : 'USDT';
  const { error } = await admin.from('bot_settings').update({
    bases, quote, position_pct: p.positionPct, stop_pct: p.stopPct, target_pct: p.targetPct, trailing_pct: p.trailingPct,
    daily_loss_pct: p.dailyLossPct, min_score: p.minScore, timeframe: p.timeframe, max_positions: p.maxPositions,
    updated_at: new Date().toISOString(),
    // mudou a estratégia → o backtest anterior deixa de valer
    backtest_done_at: null,
  }).eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, note: 'Configuração salva. Rode o backtest novamente antes de ligar o robô.' });
}
