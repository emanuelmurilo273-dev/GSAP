import { createClient } from '@supabase/supabase-js';

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`variável de ambiente ausente: ${name}`);
  return v;
}

export const sb = createClient(need('SUPABASE_URL'), need('SUPABASE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export { brtDay, brtDayStartUtc } from './util';
