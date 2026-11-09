import { adminAlert, safeEqual } from '@desk/core';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Chamado a cada 5 min (Vercel Cron ou monitor externo). Avisa o dono por e-mail se o worker parou de dar sinal de vida. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
  if (!secret || !safeEqual(token, secret)) return NextResponse.json({ error: 'proibido' }, { status: 401 });
  const admin = supabaseAdmin();
  const { count } = await admin.from('bot_settings').select('user_id', { count: 'exact', head: true }).eq('bot_enabled', true);
  const { data: hb } = await admin.from('worker_heartbeat').select('ts').eq('id', 1).maybeSingle();
  const ageMin = hb ? (Date.now() - new Date(hb.ts).getTime()) / 60_000 : Infinity;
  const down = (count ?? 0) > 0 && ageMin > 5;
  if (down) await adminAlert(admin, 'worker-down', 'WORKER PARADO', `<p>O worker não dá sinal de vida há <b>${Number.isFinite(ageMin) ? Math.round(ageMin) + ' min' : 'tempo indeterminado'}</b> e há <b>${count}</b> robô(s) ligado(s). Os stops que já estão na Binance continuam valendo, mas nada novo é analisado. Verifique o serviço do worker.</p>`, 60);

  // ---- conector MT5 (day trade B3): avisa se cair DURANTE o pregão com robô ligado ou posição aberta
  const [{ data: b3s }, { data: b3st }] = await Promise.all([
    admin.from('b3_settings').select('enabled').eq('id', 1).maybeSingle(),
    admin.from('b3_status').select('connector_ts,positions,state').eq('id', 1).maybeSingle(),
  ]);
  const sp = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(new Date());
  const wd = sp.find((p) => p.type === 'weekday')?.value ?? '';
  const hr = Number(sp.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const inHours = !['Sat', 'Sun'].includes(wd) && hr >= 9 && hr < 18;
  const b3Age = b3st?.connector_ts ? (Date.now() - new Date(b3st.connector_ts).getTime()) / 60_000 : Infinity;
  const hasPos = Array.isArray(b3st?.positions) && (b3st!.positions as unknown[]).length > 0;
  const b3Down = inHours && (!!b3s?.enabled || hasPos) && b3Age > 2;
  if (b3Down) await adminAlert(admin, 'b3-connector-down', 'CONECTOR MT5 CAIU (day trade B3)', `<p>O conector não dá sinal há <b>${Number.isFinite(b3Age) ? Math.round(b3Age) + ' min' : 'tempo indeterminado'}</b> durante o pregão${hasPos ? ' e <b>há posição aberta</b>' : ''}.</p><p>As posições abertas continuam protegidas pelo <b>stop gravado no servidor da corretora</b>. Verifique o PC/VPS (MetaTrader 5 e conector) ou use o app/site da Clear para zerar na hora.</p>`, 30);
  return NextResponse.json({ ok: !down && !b3Down, ageMin: Number.isFinite(ageMin) ? Math.round(ageMin) : null, bots: count, b3: { down: b3Down, ageMin: Number.isFinite(b3Age) ? Math.round(b3Age) : null } });
}
