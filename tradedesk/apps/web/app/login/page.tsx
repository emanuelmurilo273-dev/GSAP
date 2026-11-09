import { Logo, Panel } from '@/components/ui';
import LoginForm from './LoginForm';

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Logo />
      <div className="mt-6"><Panel title="entrar">
        {sp.erro && <p className="mb-3 text-sm text-neon-pink">Link inválido ou expirado. Peça um novo abaixo.</p>}
        <LoginForm />
        <p className="mt-4 text-[11px] text-dim">Só assinantes entram. Ainda não assinou? <a href="/checkout">Assine aqui</a>.</p>
      </Panel></div>
    </main>
  );
}
