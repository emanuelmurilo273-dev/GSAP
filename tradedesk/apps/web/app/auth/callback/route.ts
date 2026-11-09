import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

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
  if (error) return NextResponse.redirect(new URL('/login?erro=link', url));
  return NextResponse.redirect(new URL(safeNext, url));
}
