import { requireSubscriber } from '@/lib/auth';
import SettingsForm from './SettingsForm';

export default async function Page() {
  const { user, admin } = await requireSubscriber();
  const [{ data: s }, { data: acc }] = await Promise.all([
    admin.from('bot_settings').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('exchange_accounts').select('exchange,key_hint,verified').eq('user_id', user.id).maybeSingle(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-lg text-neon-purple">&gt; configurações</h1>
      <SettingsForm s={s} acc={acc} />
    </div>
  );
}
