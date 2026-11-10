import { Logo } from '@/components/ui';
import { requireSubscriber } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isOwner } = await requireSubscriber(); // bloqueia no servidor
  const links: [string, string][] = [['/app', 'Início'], ['/app/ao-vivo', 'Ao vivo'], ['/app/estatisticas', 'Estatísticas'], ['/app/historico', 'Histórico'], ['/app/desk', 'Desk (avançado)'], ['/app/settings', 'Configurações']];
  if (isOwner || profile?.role === 'owner') links.push(['/admin', 'Admin']);
  return (
    <div className="mx-auto max-w-6xl px-3 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-2 py-4"><Logo />
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium uppercase tracking-widest" aria-label="Painel">{links.map(([h, l]) => <a key={h} href={h}>{l}</a>)}
          <a href="/auth/signout" className="text-dim">sair</a></nav></header>
      {children}
    </div>
  );
}
