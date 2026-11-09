import { dateOnly, num, pct, AGENTS, Logo, Panel, Stat, tone, APP_NAME } from '@/components/ui';
import { brl, getPlanPrice } from '@/lib/price';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const revalidate = 300;

async function officialBacktests() {
  try {
    const { data } = await supabaseAdmin().from('backtests').select('*').eq('kind', 'official').order('created_at', { ascending: false }).limit(12);
    const byDays = new Map<number, any>();
    for (const r of data ?? []) if (!byDays.has(r.days)) byDays.set(r.days, r);
    return [...byDays.values()].sort((a, b) => a.days - b.days);
  } catch { return []; }
}

const FAQ = [
  ['O app guarda meu dinheiro?', 'Não. O dinheiro fica 100% na sua corretora. O robô só envia ordens pela chave de API que você cria — e recusamos chaves com permissão de saque.'],
  ['O robô garante lucro?', 'Não. Nenhum robô garante. Ele pode ter prejuízo, inclusive seguido. Os números acima são de backtest em dados históricos e não garantem o futuro.'],
  ['E se meu celular ou computador estiver desligado?', 'O robô roda em servidor, 24h. Na Binance, o stop de cada posição também fica registrado na própria corretora.'],
  ['Posso parar quando quiser?', 'Sim. Pause o robô com um toque, feche todas as posições com um botão e cancele a assinatura pelo painel, sem multa.'],
  ['Quais corretoras?', 'Binance e Mercado Bitcoin (via CCXT). Você cola a API Key/Secret da sua conta.'],
  ['O backtest é confiável?', 'Usa candles reais da corretora, com taxa e slippage. Mesmo assim é uma simulação: não inclui o LLM do Analyst, nem filas de execução reais. Mostramos o período e a data de cada resultado.'],
];

export default async function Landing() {
  const [price, bts] = await Promise.all([getPlanPrice(), officialBacktests()]);
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <nav className="flex items-center justify-between py-5">
        <Logo />
        <div className="flex gap-4 text-sm"><a href="/login">Entrar</a><a href="/checkout" className="border border-neon-green px-3 py-1 no-underline">Assinar</a></div>
      </nav>

      <section className="py-10">
        <p className="text-xs uppercase tracking-widest text-neon-purple">// trading desk · 24h · conta própria</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">Uma mesa de <span className="text-neon-green">6 agentes</span> operando cripto na <span className="text-neon-pink">sua</span> corretora.</h1>
        <p className="mt-4 max-w-2xl text-dim">Dinheiro real, sempre na sua conta. Você define o risco; o robô executa com stop em toda ordem e para sozinho quando o limite de perda do dia é atingido.</p>
        <a href="/checkout" className="mt-6 inline-block border border-neon-green bg-neon-green px-6 py-3 font-bold uppercase tracking-widest text-bg no-underline">Assinar – {brl(price)}/mês</a>
      </section>

      <Panel title="a mesa · fluxo de uma decisão" accent="#a66bff">
        <div className="relative">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-line md:block" />
          <div className="absolute top-[21px] hidden h-2.5 w-2.5 rounded-full bg-neon-green md:block" style={{ animation: 'flow 5s linear infinite' }} />
          <ol className="relative grid grid-cols-2 gap-3 md:grid-cols-6">
            {AGENTS.map((a, i) => (
              <li key={a.id} className="border bg-bg p-3 text-xs" style={{ borderColor: a.color + '66', animation: `glow 6s ease-in-out ${i}s infinite` }}>
                <div className="text-lg font-bold" style={{ color: a.color }}>0{a.n}</div>
                <div className="font-bold uppercase" style={{ color: a.color }}>{a.name}</div>
                <p className="mt-1 text-dim">{a.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </Panel>

      <section className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-neon-blue">&gt; resultados reais do backtest oficial</h2>
        {bts.length === 0 ? (
          <Panel><p className="text-sm text-dim">O backtest oficial ainda não foi executado. Quando for (toda semana), os números reais aparecem aqui — não exibimos nada inventado.</p></Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {bts.map((b) => (
              <Panel key={b.id} title={`${b.symbol} · ${b.days} dias · ${b.timeframe}`} accent="#39ff88">
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Resultado" value={pct(b.metrics.totalPnlPct)} tone={tone(b.metrics.totalPnlPct)} />
                  <Stat label="Taxa de acerto" value={b.metrics.winRate == null ? '—' : `${(b.metrics.winRate * 100).toFixed(1)}%`} />
                  <Stat label="Drawdown máx." value={`-${(b.metrics.maxDrawdownPct * 100).toFixed(1)}%`} tone="neg" />
                  <Stat label="Fator de lucro" value={b.metrics.profitFactor == null ? '—' : num(b.metrics.profitFactor)} />
                  <Stat label="Trades" value={b.metrics.trades} />
                  <Stat label="Comprar e segurar" value={pct(b.metrics.buyHoldPct)} tone={tone(b.metrics.buyHoldPct)} sub="referência no mesmo período" />
                </div>
                <p className="mt-3 text-[11px] text-dim">Dados: {dateOnly(b.data_from)} a {dateOnly(b.data_to)} · calculado em {dateOnly(b.created_at)} · {b.exchange} · taxa {(b.metrics.feePct * 100).toFixed(2)}% + slippage {(b.metrics.slippagePct * 100).toFixed(2)}% por execução · parâmetros padrão.</p>
              </Panel>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-neon-orange">Simulação em dados históricos. Não garante resultado futuro e não inclui o ajuste do LLM.</p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[['Sua conta, seu dinheiro', 'Chave de API com permissão de trade apenas. Chaves com saque são recusadas. Criptografia AES-256.', '#39ff88'],
          ['Risco sob controle', 'Stop em toda ordem, % máximo por trade, limite de perda diária, nunca preço médio.', '#ffa21f'],
          ['Backtest obrigatório', 'O robô só liga depois de você rodar o backtest com a SUA configuração.', '#3aa8ff']].map(([t, d, c]) => (
          <Panel key={t} title={t} accent={c}><p className="text-sm text-dim">{d}</p></Panel>))}
      </section>

      <section className="mt-8">
        <Panel title="preço" accent="#ff4fa3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><div className="text-4xl font-bold text-neon-green">{brl(price)}<span className="text-base text-dim">/mês</span></div>
              <p className="mt-1 text-sm text-dim">Pix ou cartão · recorrente · cancele quando quiser pelo painel · acesso liberado por e-mail após a confirmação.</p></div>
            <a href="/checkout" className="border border-neon-green px-5 py-3 font-bold uppercase tracking-widest text-neon-green no-underline hover:bg-neon-green hover:text-bg">Assinar – {brl(price)}/mês</a>
          </div>
        </Panel>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-neon-purple">&gt; faq</h2>
        <div className="space-y-2">{FAQ.map(([q, a]) => (
          <details key={q} className="border border-line bg-panel p-3"><summary className="cursor-pointer text-neon-green">{q}</summary><p className="mt-2 text-sm text-dim">{a}</p></details>))}</div>
      </section>

      <section className="mt-8 border border-neon-orange/60 p-4 text-sm text-neon-orange">
        <b>AVISO DE RISCO.</b> Criptomoedas são ativos de alto risco e volatilidade. Você pode perder parte ou todo o capital. O robô opera automaticamente com dinheiro real e pode ter prejuízo, inclusive por falhas de corretora, API, conexão ou do próprio modelo. Resultados passados (inclusive backtests) não garantem resultados futuros. {APP_NAME} não é recomendação de investimento nem consultoria financeira. Opere apenas com valores que pode perder.
      </section>

      <footer className="mt-8 flex gap-4 text-xs text-dim"><a href="/terms">Termos de uso</a><a href="/privacy">Privacidade (LGPD)</a></footer>
    </main>
  );
}
