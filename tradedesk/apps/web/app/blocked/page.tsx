import { Logo, Panel } from '@/components/ui';

export default function Blocked() {
  return (
    <main className="mx-auto max-w-md px-4 py-6"><Logo />
      <div className="mt-6"><Panel title="acesso bloqueado" accent="#ff4fa3">
        <p className="text-sm">Sua assinatura está inativa (pagamento pendente, vencido ou acesso suspenso). O robô foi pausado.</p>
        <p className="mt-2 text-sm text-dim">Posições abertas na Binance continuam com o stop registrado na corretora. Regularize o pagamento — o acesso volta automaticamente. Para assinar de novo, <a href="/checkout">clique aqui</a>.</p>
      </Panel></div>
    </main>
  );
}
