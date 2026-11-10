import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const hits = new Map<string, number[]>();

/** Lista de espera: só e-mail + aceite explícito (LGPD). Limitado por IP. */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'ip';
  const now = Date.now(); const arr = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000); arr.push(now); hits.set(ip, arr);
  if (arr.length > 5) return NextResponse.json({ error: 'muitas tentativas, aguarde' }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S{2,}$/.test(email) || email.length > 120 || b.consent !== true) return NextResponse.json({ error: 'informe um e-mail válido e aceite o contato' }, { status: 400 });
  await supabaseAdmin().from('waitlist').upsert({ email, ip: ip.slice(0, 45) });
  return NextResponse.json({ ok: true });
}
