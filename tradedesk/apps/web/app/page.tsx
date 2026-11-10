import { Logo } from '@/components/Logo';

export const metadata = { title: 'Robô de day trade na B3' };

/** Página pública mínima: o robô é de uso pessoal do dono. Não promete lucro e diz o que ele é. */
export default function Landing() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center gap-8 px-5 py-16">
      <Logo />
      <div>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Robô de day trade<br /><span className="text-executor">na B3.</span></h1>
        <p className="mt-5 text-lg leading-relaxed text-dim">Opera mini índice (WIN) e mini dólar (WDO) pelo MetaTrader 5 da Clear. Começa sempre no <b className="text-ink">simulador</b>, coloca <b className="text-ink">stop em toda ordem</b> e só usa dinheiro de verdade depois de provar, com números, que tem vantagem.</p>
      </div>
      <ul className="space-y-2 text-sm text-dim">
        <li>• Dinheiro real <b className="text-ink">travado</b> por padrão.</li>
        <li>• Limite de perda diário, parada após 2 perdas, zeragem às 17:30, botão PARAR TUDO.</li>
        <li>• Sem promessa de lucro: se não tiver vantagem, o app diz isso com todas as letras.</li>
      </ul>
      <a href="/owner/login" className="inline-flex w-fit items-center rounded-2xl bg-executor px-7 py-4 text-lg font-semibold text-bg transition hover:brightness-110">Entrar</a>
    </main>
  );
}
