import type { SupabaseClient } from '@supabase/supabase-js';

export async function audit(sb: SupabaseClient, e: { actor: string | null; email?: string | null; action: string; detail?: Record<string, unknown>; ip?: string | null }) {
  await sb.from('audit_log').insert({ actor: e.actor, email: e.email ?? null, action: e.action, detail: e.detail ?? {}, ip: e.ip ?? null });
}
