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
  return NextResponse.json({ ok: !down, ageMin: Number.isFinite(ageMin) ? Math.round(ageMin) : null, bots: count });
}
