import { createClient } from '@supabase/supabase-js';

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`variável de ambiente ausente: ${name}`);
  return v;
}

export const sb = createClient(need('SUPABASE_URL'), need('SUPABASE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Data (YYYY-MM-DD) no fuso de Brasília — o "dia" do limite de perda diária. */
export const brtDay = (d = new Date()) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
export const brtDayStartUtc = (day = brtDay()) => new Date(`${day}T03:00:00.000Z`);
