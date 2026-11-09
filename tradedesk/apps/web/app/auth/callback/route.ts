import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { publicUrl } from '@/lib/public-url';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { auditOwner, ensureOwner, isOwnerEmail } from '@/lib/owner';

/** Aceita o link do e-mail de boas-vindas (token_hash) e o link mágico de login (code PKCE). */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get('next') ?? '/app';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app';
  const sb = await supabaseServer();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  let error: unknown = null;
  if (code) ({ error } = await sb.auth.exchangeCodeForSession(code));
  else if (tokenHash) ({ error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: (url.searchParams.get('type') as any) ?? 'magiclink' }));
  else error = new Error('sem credencial');
  if (error) return NextResponse.redirect(publicUrl(req, '/login?erro=link'));
  const { data } = await sb.auth.getUser();
  if (data.user && isOwnerEmail(data.user.email)) {
    const admin = supabaseAdmin();
    if (await ensureOwner(admin, data.user)) {
      await auditOwner(admin, data.user, 'owner.login', { method: 'magic_link' }, req);
      // dono cai direto nas operações (/app); exige 2FA — sem fator cadastrado, vai para /owner/security
      return NextResponse.redirect(publicUrl(req, safeNext.startsWith('/owner') ? safeNext : (process.env.OWNER_HOME ?? '/b3')));
    }
  }
  return NextResponse.redirect(publicUrl(req, safeNext));
}
