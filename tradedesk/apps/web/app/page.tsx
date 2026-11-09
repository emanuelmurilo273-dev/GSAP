import LandingView from '@/components/LandingView';
import { getPlanPrice } from '@/lib/price';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const revalidate = 300;

async function officialBacktests() {
  try {
    const { data } = await supabaseAdmin().from('backtests').select('*').eq('kind', 'official').order('created_at', { ascending: false }).limit(12);
    const byDays = new Map<number, any>();
    for (const r of data ?? []) if (!byDays.has(r.days)) byDays.set(r.days, r);
    return [...byDays.values()].sort((a, b) => a.days - b.days);
  } catch { return []; }
}

export default async function Landing() {
  const [price, bts] = await Promise.all([getPlanPrice(), officialBacktests()]);
  return <LandingView price={price} bts={bts} />;
}
