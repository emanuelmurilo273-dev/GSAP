import { requireSubscriber } from '@/lib/auth';
import ClientHome from '@/components/ClientHome';

export const metadata = { title: 'Início' };

export default async function Page() {
  await requireSubscriber();
  return <ClientHome />;
}
