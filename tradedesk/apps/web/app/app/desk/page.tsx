import Desk from '@/components/Desk';
import { requireSubscriber } from '@/lib/auth';

export const metadata = { title: 'Desk · 6 agents' };

export default async function Page() {
  await requireSubscriber();
  return <Desk />;
}
