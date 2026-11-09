import { requireOwner } from '@/lib/auth';
import B3Config from './B3Config';

export const metadata = { title: 'Config · Day trade B3' };

export default async function Page() {
  const { admin } = await requireOwner();
  const { data } = await admin.from('b3_settings').select('*').eq('id', 1).maybeSingle();
  return <B3Config initial={data} />;
}
