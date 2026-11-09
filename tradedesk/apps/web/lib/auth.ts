import 'server-only';
import { hasAccess, type SubscriptionRow } from '@desk/core';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from './supabase/admin';
import { supabaseServer } from './supabase/server';

export async function currentUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser(); // valida o JWT no Supabase (não confia só no cookie)
  return data.user;
}

/** Para páginas: exige login + assinatura ativa. SEMPRE checado no servidor. */
export async function requireSubscriber() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const admin = supabaseAdmin();
  const [{ data: sub }, { data: prof }] = await Promise.all([
    admin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);
  if (!hasAccess(sub as SubscriptionRow)) redirect('/blocked');
  return { user, sub: sub!, profile: prof, admin };
}

export async function requireOwner() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (prof?.role !== 'owner') redirect('/');
  return { user, admin };
}

type Guard<T> = { ok: true; data: T } | { ok: false; res: NextResponse };

/** Para rotas de API (JSON). */
export async function apiSubscriber(): Promise<Guard<{ userId: string; admin: ReturnType<typeof supabaseAdmin> }>> {
  const user = await currentUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const admin = supabaseAdmin();
  const { data: sub } = await admin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();
  if (!hasAccess(sub as SubscriptionRow)) return { ok: false, res: NextResponse.json({ error: 'assinatura inativa' }, { status: 403 }) };
  return { ok: true, data: { userId: user.id, admin } };
}

export async function apiOwner(): Promise<Guard<{ userId: string; admin: ReturnType<typeof supabaseAdmin> }>> {
  const user = await currentUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) };
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (prof?.role !== 'owner') return { ok: false, res: NextResponse.json({ error: 'proibido' }, { status: 403 }) };
  return { ok: true, data: { userId: user.id, admin } };
}
