import { requireSubscriber } from '@/lib/auth';
import AoVivo from './AoVivo';

export const metadata = { title: 'Ao vivo' };

export default async function Page() {
  const { isOwner } = await requireSubscriber();
  return (<div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Ao vivo</h1><AoVivo hasB3={isOwner} /></div>);
}
