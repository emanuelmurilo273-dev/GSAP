import 'server-only';
import { hasAccess, type SubscriptionRow } from '@desk/core';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from './supabase/admin';
import { supabaseServer } from './supabase/server';
import { aalOf, ensureOwner } from './owner';

export async function currentUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser(); // valida o JWT no Supabase (não confia só no cookie)
  return data.user;
}

/** Dono autenticado COM 2FA (aal2). Retorna null se não for dono. Checado sempre no servidor. */
async function ownerSession(user: { id: string; email?: string | null; email_confirmed_at?: string | null }, admin: ReturnType<typeof supabaseAdmin>) {
  const { data: prof } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
  let role = prof?.role;
  if (role !== 'owner' && (await ensureOwner(admin, user as any))) role = 'owner';
  if (role !== 'owner') return null;
  const sb = await supabaseServer();
  const aal = await aalOf(sb as any);
  return { profile: { ...(prof ?? {}), role: 'owner' }, aal2: aal.current === 'aal2', hasFactor: aal.next === 'aal2' || aal.current === 'aal2' };
}

/** Para páginas: exige login + assinatura ativa (o dono entra sem assinatura, mas só com 2FA). */
export async function requireSubscriber() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const admin = supabaseAdmin();
  const owner = await ownerSession(user, admin);
  if (owner) {
    if (!owner.aal2) redirect(owner.hasFactor ? '/owner/login' : '/owner/security');
    return { user, sub: null as any, profile: owner.profile, admin, isOwner: true as const };
  }
  const [{ data: sub }, { data: prof }] = await Promise.all([
    admin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);
  if (!hasAccess(sub as SubscriptionRow)) redirect('/blocked');
  return { user, sub: sub!, profile: prof, admin, isOwner: false as const };
}

export async function requireOwner() {
  const user = await currentUser();
  if (!user) redirect('/owner/login');
  const admin = supabaseAdmin();
  const owner = await ownerSession(user, admin);
  if (!owner) redirect('/');
  if (!owner.aal2) redirect(owner.hasFactor ? '/owner/login' : '/owner/security');
  return { user, admin };
}

type Guard<T> = { ok: true; data: T } | { ok: false; res: NextResponse };

/** Para rotas de API (JSON). */
export async function apiSubscriber(): Promise<Guard<{ userId: string; isOwner: boolean; admin: ReturnType<typeof supabaseAdmin> }>> {
  const user = await currentUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const admin = supabaseAdmin();
  const owner = await ownerSession(user, admin);
  if (owner) {
    if (!owner.aal2) return { ok: false, res: NextResponse.json({ error: 'dono precisa do 2FA' }, { status: 403 }) };
    return { ok: true, data: { userId: user.id, isOwner: true, admin } };
  }
  const { data: sub } = await admin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();
  if (!hasAccess(sub as SubscriptionRow)) return { ok: false, res: NextResponse.json({ error: 'assinatura inativa' }, { status: 403 }) };
  return { ok: true, data: { userId: user.id, isOwner: false, admin } };
}

export async function apiOwner(): Promise<Guard<{ userId: string; email: string | null; admin: ReturnType<typeof supabaseAdmin> }>> {
  const user = await currentUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const admin = supabaseAdmin();
  const owner = await ownerSession(user, admin);
  if (!owner || !owner.aal2) return { ok: false, res: NextResponse.json({ error: 'proibido' }, { status: 403 }) };
  return { ok: true, data: { userId: user.id, email: user.email ?? null, admin } };
}
