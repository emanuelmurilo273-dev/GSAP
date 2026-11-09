import 'server-only';
import { supabaseAdmin } from './supabase/admin';

/** Preço atual: override do admin (app_settings) → variável PLAN_PRICE → 7000. */
export async function getPlanPrice(): Promise<number> {
  try {
    const { data } = await supabaseAdmin().from('app_settings').select('value').eq('key', 'plan_price').maybeSingle();
    const v = Number((data?.value as any)?.amount);
    if (v > 0) return v;
  } catch { /* sem banco: usa env */ }
  return Number(process.env.PLAN_PRICE ?? 7000);
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
