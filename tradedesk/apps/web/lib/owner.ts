import 'server-only';
import { audit } from '@desk/core';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * 2FA do dono é obrigatório. Única exceção: instalação LOCAL (OWNER_REQUIRE_2FA=false E site em localhost/127.0.0.1).
 * Em qualquer endereço de internet a variável é IGNORADA e o 2FA continua obrigatório.
 */
export const twoFactorRequired = () => {
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(process.env.NEXT_PUBLIC_APP_URL ?? '');
  return !(process.env.OWNER_REQUIRE_2FA === 'false' && local);
};
export const ownerEmail = () => (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
export const isOwnerEmail = (email?: string | null) => !!ownerEmail() && (email ?? '').toLowerCase() === ownerEmail();
export const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

/**
 * OWNER_EMAIL vira role=owner automaticamente no primeiro login (sem checkout, sem assinatura).
 * Só promove se o e-mail estiver CONFIRMADO no Supabase Auth (link mágico ou senha após confirmação).
 */
export async function ensureOwner(admin: SupabaseClient, user: User): Promise<boolean> {
  if (!isOwnerEmail(user.email) || !user.email_confirmed_at) return false;
  await admin.from('profiles').upsert({ id: user.id, email: user.email!, role: 'owner' });
  await admin.from('bot_settings').upsert({ user_id: user.id }, { ignoreDuplicates: true });
  return true;
}

export async function aalOf(sb: { auth: { mfa: { getAuthenticatorAssuranceLevel: () => Promise<any> } } }) {
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  return { current: data?.currentLevel as string | null, next: data?.nextLevel as string | null };
}

export const auditOwner = (admin: SupabaseClient, user: { id: string; email?: string | null }, action: string, detail: Record<string, unknown> = {}, req?: Request) =>
  audit(admin, { actor: user.id, email: user.email, action, detail, ip: req ? clientIp(req) : null }).catch(() => undefined);
