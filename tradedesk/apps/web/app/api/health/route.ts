import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Para monitor de uptime (UptimeRobot etc.): 200 se o app E o banco respondem; 503 se o banco não responde. Não expõe nada sensível. */
export async function GET() {
  const t0 = Date.now();
  try {
    const { error } = await supabaseAdmin().from('app_settings').select('key').limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, db: 'ok', ms: Date.now() - t0 }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
