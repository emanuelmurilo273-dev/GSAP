import BacktestRunner from '@/components/BacktestRunner';
import { toForm } from '@/lib/pform';
import { requireSubscriber } from '@/lib/auth';
import { settingsToParams } from '@/lib/params';
import { DEFAULT_PARAMS } from '@desk/core';

export default async function Page() {
  const { user, admin } = await requireSubscriber();
  const [{ data: s }, { data: acc }] = await Promise.all([
    admin.from('bot_settings').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('exchange_accounts').select('exchange').eq('user_id', user.id).maybeSingle(),
  ]);
  const quote = s?.quote ?? 'USDT';
  const symbols = (s?.bases ?? ['BTC', 'ETH', 'SOL']).map((b: string) => `${b}/${quote}`);
  return (
    <div className="space-y-3">
      <h1 className="text-lg text-neon-blue">&gt; backtest</h1>
      <p className="text-sm text-dim">Roda a estratégia em dados históricos reais da corretora, com taxas e slippage. Obrigatório antes de ligar o robô.</p>
      <BacktestRunner symbols={symbols} exchange={acc?.exchange ?? 'binance'} initial={toForm(s ? settingsToParams(s) : DEFAULT_PARAMS)} />
    </div>
  );
}
