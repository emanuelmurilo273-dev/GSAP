import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_NAME, emailLayout, sendEmail } from './email';

/** E-mail para o dono (OWNER_EMAIL) com anti-spam: no máximo 1 por `key` a cada `cooldownMin`. */
export async function adminAlert(sb: SupabaseClient, key: string, subject: string, bodyHtml: string, cooldownMin = 60): Promise<boolean> {
  const to = process.env.OWNER_EMAIL;
  if (!to) return false;
  const { data } = await sb.from('alerts_sent').select('ts').eq('key', key).maybeSingle();
  if (data && Date.now() - new Date(data.ts).getTime() < cooldownMin * 60_000) return false;
  await sb.from('alerts_sent').upsert({ key, ts: new Date().toISOString() });
  return sendEmail(to, `[${APP_NAME}] ${subject}`, emailLayout('alerta', bodyHtml));
}

/** Erros que indicam chave inválida/revogada/sem permissão (e não instabilidade passageira). */
export const isKeyError = (msg: string) => /invalid api-key|api-key format|-2015|-2014|signature|AuthenticationError|PermissionDenied|permission/i.test(msg);
