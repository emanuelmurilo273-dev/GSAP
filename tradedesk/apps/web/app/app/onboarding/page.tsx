import { RISK_TERMS_VERSION } from '@desk/core';
import { requireSubscriber } from '@/lib/auth';
import Onboarding from './Onboarding';

export default async function Page() {
  const { user, admin } = await requireSubscriber();
  const [{ data: s }, { data: acc }] = await Promise.all([
    admin.from('bot_settings').select('backtest_done_at,risk_accepted_at,risk_terms_version,bot_enabled').eq('user_id', user.id).maybeSingle(),
    admin.from('exchange_accounts').select('exchange,key_hint,verified,attested_no_withdraw').eq('user_id', user.id).maybeSingle(),
  ]);
  return (
    <Onboarding
      acc={acc ? { exchange: acc.exchange, hint: acc.key_hint, verified: acc.verified } : null}
      backtest={!!s?.backtest_done_at}
      risk={!!s?.risk_accepted_at && s.risk_terms_version === RISK_TERMS_VERSION}
      enabled={!!s?.bot_enabled}
    />
  );
}
