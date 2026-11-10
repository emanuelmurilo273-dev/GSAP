import { computeStats, salesOpen } from '@desk/core';
import { Logo } from '@/components/Logo';
import Waitlist from '@/components/Waitlist';
import { brl, getPlanPrice } from '@/lib/price';
import { loadRealTrades, ownerIds } from '@/lib/stats';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const revalidate = 300;
export const metadata = { title: 'Robô de trading automático — B3 e cripto' };
const FOOT = 'Operações em renda variável podem gerar perdas. Resultados passados não garantem resultados futuros.';
const R$ = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Landing() {
  let s: ReturnType<typeof computeStats> | null = null, price = 0;
  try { const admin = supabaseAdmin(); const { trades } = await loadRealTrades(admin, { owners: await ownerIds(admin) }); s = computeStats(trades); price = await getPlanPrice(); } catch { /* sem banco: mostra sem números */ }
  const open = salesOpen();
  return (
    <main>
      <section className="mx-auto flex min-h-[78vh] max-w-3xl flex-col justify-center gap-8 px-5 py-16">
        <Logo />
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Um robô que opera<br /><span className="text-executor">na sua conta.</span></h1>
          <p className="mt-5 text-lg leading-relaxed text-dim">Mini índice e mini dólar na <b className="text-ink">B3</b> (pelo MetaTrader 5 da Clear) e <b className="text-ink">BTC, ETH e SOL em reais</b> na Foxbit, 24 horas. O dinheiro fica sempre na <b className="text-ink">sua</b> conta: o app nunca recebe depósitos nem tem permissão de saque.</p>
        </div>
        {open ? <a href="/checkout" className="inline-flex w-fit rounded-2xl bg-executor px-7 py-4 text-lg font-semibold text-bg hover:brightness-110">Assinar · {brl(price)}/mês</a> : (
          <div className="space-y-3"><p className="rounded-2xl border border-filter/30 bg-filter/10 p-4 text-sm text-filter"><b>Venda ainda não aberta.</b> O robô só será vendido quando uma estratégia passar no teste fora da amostra com os critérios publicados. Hoje isso <b>ainda não aconteceu</b>; veja os números reais abaixo.</p><Waitlist /></div>)}
        <p className="text-xs text-dim">Já é cliente? <a className="underline" href="/login">Entrar</a></p>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 px-5 pb-12">
        <h2 className="text-2xl font-semibold">Como ele se protege</h2>
        <ul className="grid gap-3 sm:grid-cols-2">{[
          ['Stop em toda ordem', 'Enviado ao servidor da corretora sempre que ela permite.'], ['Limite de perda por dia', 'Bateu o limite, para até amanhã. Uma perda no dia também para o robô.'],
          ['Risco máximo de 1% por operação', 'Sem alavancagem. Sem martingale, sem preço médio, sem aumentar a mão para recuperar.'], ['Trava de 5% do pico', 'Se a conta cair 5% do maior valor, o robô pausa e avisa você.'],
        ].map(([t, d]) => <li key={t} className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><b>{t}</b><p className="mt-1 text-sm text-dim">{d}</p></li>)}</ul>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 px-5 pb-12">
        <h2 className="text-2xl font-semibold">Resultados reais, sem filtro</h2>
        {s && s.n ? (<p className="text-dim">{s.n} operações reais desde {new Date(s.firstTradeAt!).toLocaleDateString('pt-BR')}: resultado líquido <b className={s.net >= 0 ? 'text-executor' : 'text-risk'}>{R$(s.net)}</b>, média de <b>{R$(s.expectancy ?? 0)}</b> por operação, {s.negativeDays} de {s.totalDays} dias negativos.</p>) : <p className="text-dim">Ainda não há operações reais registradas. Nada é estimado nem inventado: quando houver, o histórico completo aparece na página de resultados.</p>}
        <a href="/resultados" className="inline-block rounded-xl border border-white/15 px-5 py-3 text-sm hover:bg-white/10">Ver a página de resultados completa →</a>
      </section>

      <section className="mx-auto max-w-3xl space-y-3 px-5 pb-16" id="faq">
        <h2 className="text-2xl font-semibold">Perguntas frequentes</h2>
        {[
          ['Eu vou ganhar dinheiro?', 'Ninguém pode prometer isso e nós não prometemos. O robô pode ter prejuízo, inclusive perda de todo o valor alocado. Por isso mostramos todos os resultados, dias negativos incluídos.'],
          ['O app mexe no meu dinheiro?', 'Não. Seu dinheiro fica na sua corretora. O app usa uma chave de API sem permissão de saque (na B3, o login do MT5 fica só no conector do seu computador/VPS). Pode desconectar a qualquer momento.'],
          ['Por que a venda não está aberta?', 'Porque definimos critérios antes de vender: fator de lucro ≥ 1,3, perda máxima ≤ 10% e pelo menos 300 operações no teste fora da amostra. Até passar, só lista de espera.'],
          ['Quanto custa?', open ? `${brl(price)} por mês, no Pix ou cartão, sem fidelidade.` : 'O preço será divulgado quando a venda abrir. Fora a assinatura, existem os custos da corretora (taxas e emolumentos), que aparecem separados nas estatísticas.'],
          ['E se o robô parar ou a internet cair?', 'Os stops ficam na corretora e continuam valendo. Você recebe aviso por e-mail e há o botão PARAR TUDO.'],
          ['Isto é recomendação de investimento?', 'Não. É um software que executa regras automáticas na sua conta, por sua conta e risco. Consulte um profissional se tiver dúvidas.'],
        ].map(([q, a]) => <details key={q} className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm leading-relaxed text-dim">{a}</p></details>)}
      </section>

      <footer className="border-t border-white/[.07] px-5 py-8 text-center text-xs text-dim"><p className="mx-auto max-w-2xl font-medium text-ink/80">{FOOT}</p><p className="mt-3 space-x-4"><a href="/resultados">Resultados</a><a href="/terms">Termos de uso</a><a href="/privacy">Privacidade (LGPD)</a></p></footer>
    </main>
  );
}
