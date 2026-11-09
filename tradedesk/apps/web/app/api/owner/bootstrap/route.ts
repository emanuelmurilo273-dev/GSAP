import { APP_NAME, emailLayout, sendEmail } from '@desk/core';
import { NextResponse } from 'next/server';
import { ownerEmail } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase/admin';

let last = 0;

/** "Primeiro acesso / esqueci a senha": envia link mágico SOMENTE para OWNER_EMAIL (nenhum e-mail vem do cliente). */
export async function POST() {
  const to = ownerEmail();
  if (!to) return NextResponse.json({ ok: true }); // resposta neutra
  if (Date.now() - last < 60_000) return NextResponse.json({ ok: true });
  last = Date.now();
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from('profiles').select('id').eq('email', to).maybeSingle();
  if (!prof) {
    const { error } = await admin.auth.admin.createUser({ email: to, email_confirm: true });
    if (error && !/already|registered/i.test(error.message)) console.error('[owner bootstrap]', error.message);
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: to });
  if (error || !data?.properties?.hashed_token) return NextResponse.json({ ok: true });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const link = `${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/owner/security`;
  await sendEmail(to, `${APP_NAME} · acesso do dono`, emailLayout('acesso do dono', `<p><a style="color:#39ff88;font-size:16px" href="${link}">&gt; ENTRAR (link único)</a></p><p style="color:#6b8f7a">Depois do link você define a senha e ativa o 2FA (app autenticador).</p>`));
  return NextResponse.json({ ok: true });
}
