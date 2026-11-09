import { Logo, Panel } from '@/components/ui';
import { brl, getPlanPrice } from '@/lib/price';
import CheckoutForm from './CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function Checkout() {
  const price = await getPlanPrice();
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <Logo />
      <div className="mt-6"><Panel title="assinatura">
        <p className="mb-4 text-sm text-dim">Plano mensal: <b className="text-neon-green">{brl(price)}</b>. Pague com Pix (QR Code ou copia-e-cola) ou cartão. Assim que o pagamento for confirmado, sua conta é criada e o link de acesso chega por e-mail.</p>
        <CheckoutForm price={brl(price)} />
      </Panel></div>
      <p className="mt-4 text-[11px] text-dim">Ao assinar você concorda com os <a href="/terms">Termos</a> e a <a href="/privacy">Política de Privacidade</a>.</p>
    </main>
  );
}
