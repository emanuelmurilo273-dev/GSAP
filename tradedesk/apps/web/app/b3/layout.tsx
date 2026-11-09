import { Logo } from '@/components/ui';
import { requireOwner } from '@/lib/auth';
import ModeBanner from './ModeBanner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Day trade B3' };

export default async function B3Layout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireOwner();
  const { data } = await admin.from('b3_settings').select('mode').eq('id', 1).maybeSingle();
  return (
    <div>
      <ModeBanner initial={data?.mode ?? 'sim'} />
      <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 py-4"><Logo href="/b3" />
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium uppercase tracking-widest" aria-label="Day trade B3">
            <a href="/b3">Início</a><a href="/b3/saude">Saúde do robô</a><a href="/b3/live">Ao vivo</a><a href="/b3/inteligencia">Inteligência</a><a href="/b3/detalhes">Detalhes</a><a href="/b3/config">Config</a><a href="/auth/signout" className="text-dim">sair</a></nav></header>
        {children}
      </div>
    </div>
  );
}
