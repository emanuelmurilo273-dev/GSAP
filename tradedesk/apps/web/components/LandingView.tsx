import FlowHero from '@/components/FlowHero';
import Reveal from '@/components/Reveal';
import { AGENTS, APP_NAME, LineChart, Logo, Panel, Stat, dateOnly, num, pct, tone } from '@/components/ui';
import { brl } from '@/lib/price-format';

const FAQ = [
  ['O app guarda meu dinheiro?', 'Não. O dinheiro fica 100% na sua corretora. O robô só envia ordens pela chave de API que você cria — e recusamos chaves com permissão de saque.'],
  ['O robô garante lucro?', 'Não. Nenhum robô garante. Ele pode ter prejuízo, inclusive seguido. Os números exibidos são de backtest em dados históricos e não garantem o futuro.'],
  ['E se meu celular ou computador estiver desligado?', 'O robô roda em servidor, 24h. Na Binance, o stop de cada posição também fica registrado na própria corretora.'],
  ['Posso parar quando quiser?', 'Sim. Pause o robô com um toque, feche todas as posições com um botão e cancele a assinatura pelo painel, sem multa.'],
  ['Quais corretoras?', 'Binance e Bybit. Você cola a API Key/Secret da sua conta, criada sem permissão de saque.'],
  ['O backtest é confiável?', 'Usa candles reais da corretora, com taxa e slippage. Ainda assim é simulação: não inclui o ajuste do LLM nem filas de execução reais. Mostramos o período e a data de cada resultado.'],
];

const HOW = [
  ['Você conecta', 'Cria uma chave de API na sua corretora só com permissão de trade e cola aqui. Validamos na hora e recusamos chaves com saque.'],
  ['Você prova no passado', 'Roda o backtest com a sua configuração, em dados reais, com taxas e slippage. Sem backtest, o robô não liga.'],
  ['A mesa opera', 'Seis agentes trabalham 24h: coletam, filtram, analisam, executam, controlam o risco e registram cada decisão.'],
  ['Você acompanha', 'Saldo real da corretora, posições, log em tempo real, relatório diário por e-mail. Pause ou feche tudo com um botão.'],
];

export default function LandingView({ price, bts }: { price: number; bts: any[] }) {
  const hero = bts.find((b) => b.days === 365) ?? bts[bts.length - 1];
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <nav className="flex items-center justify-between py-5" aria-label="Principal">
        <Logo />
        <div className="flex items-center gap-3 text-sm"><a href="/login" className="text-dim no-underline hover:text-ink">Entrar</a>
          <a href="/checkout" className="rounded-lg border border-executor/50 bg-executor/10 px-3.5 py-1.5 font-semibold text-executor no-underline hover:bg-executor hover:text-bg">Assinar</a></div>
      </nav>

      <section className="py-12 sm:py-20">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-analyst">// mesa de trading · 24h · conta própria</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">Uma mesa de <span className="text-executor">6 agentes</span> operando cripto na <span className="bg-gradient-to-r from-risk to-analyst bg-clip-text text-transparent">sua</span> corretora.</h1>
          <p className="mt-5 max-w-2xl text-base text-dim sm:text-lg">Dinheiro real, sempre na sua conta. Você define o risco; a mesa executa com stop em toda ordem e para sozinha quando o limite de perda do dia é atingido.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="/checkout" className="rounded-lg bg-executor px-6 py-3 font-semibold text-bg no-underline hover:brightness-110">Assinar – {brl(price)}/mês</a>
            <a href="#como-funciona" className="rounded-lg border border-white/10 px-5 py-3 text-sm text-ink no-underline hover:border-white/25">Ver como funciona</a>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="mt-12"><FlowHero /></Reveal>
      </section>

      <section id="como-funciona" className="py-10">
        <Reveal><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Como funciona</h2></Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.06}><div className="glass glass-hover h-full p-5"><div className="font-mono text-xs text-dim">0{i + 1}</div><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-dim">{d}</p></div></Reveal>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a) => (
            <div key={a.id} className="glass flex gap-3 p-4" style={{ borderColor: a.color + '33' }}>
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color, boxShadow: `0 0 12px ${a.color}` }} />
              <div><div className="text-sm font-semibold" style={{ color: a.color }}>{a.name}</div><p className="mt-1 text-sm leading-snug text-dim">{a.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10">
        <Reveal><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Resultados reais do backtest</h2>
          <p className="mt-2 max-w-2xl text-sm text-dim">Candles reais, taxa e slippage incluídos. Cada número traz o período e a data do cálculo. Nada é inventado.</p></Reveal>
        {bts.length === 0 ? (
          <Panel className="mt-6"><p className="text-sm text-dim">O backtest oficial ainda não foi executado. Quando for (toda semana), os números reais aparecem aqui.</p></Panel>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            {hero && <Panel title={`equity · ${hero.symbol} · ${hero.days} dias`} accent="#3ddc84" className="lg:col-span-3"><LineChart data={(hero.equity as { t: number; v: number }[])} height={240} /></Panel>}
            <div className="grid gap-4 lg:col-span-2">
              {bts.map((b) => (
                <Panel key={b.id} title={`${b.symbol} · ${b.days}d · ${b.timeframe}`} accent="#4da3ff">
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Resultado" value={pct(b.metrics.totalPnlPct)} tone={tone(b.metrics.totalPnlPct)} />
                    <Stat label="Acerto" value={b.metrics.winRate == null ? '—' : `${(b.metrics.winRate * 100).toFixed(0)}%`} />
                    <Stat label="DD máx." value={`-${(b.metrics.maxDrawdownPct * 100).toFixed(1)}%`} tone="neg" />
                    <Stat label="F. lucro" value={b.metrics.profitFactor == null ? '—' : num(b.metrics.profitFactor)} />
                    <Stat label="Trades" value={b.metrics.trades} />
                    <Stat label="Buy&hold" value={pct(b.metrics.buyHoldPct, 1)} tone={tone(b.metrics.buyHoldPct)} />
                  </div>
                  <p className="mt-3 text-[11px] leading-snug text-dim">Dados de {dateOnly(b.data_from)} a {dateOnly(b.data_to)} · calculado em {dateOnly(b.created_at)} · taxa {(b.metrics.feePct * 100).toFixed(2)}% + slippage {(b.metrics.slippagePct * 100).toFixed(2)}%.</p>
                </Panel>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-filter">Simulação em dados históricos. Não garante resultado futuro e não inclui o ajuste do LLM.</p>
      </section>

      <section className="py-10">
        <Reveal><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Segurança em primeiro lugar</h2></Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[['Não custodial', 'Seu dinheiro nunca passa por nós. Ele fica na corretora, na sua conta.', '#3ddc84'],
            ['Chave sem saque', 'Recusamos chaves com permissão de saque. Armazenamos criptografado (AES-256).', '#4da3ff'],
            ['Stop em toda ordem', 'Stop, alvo, limite de perda diária e nunca preço médio. Na Binance, o stop fica na própria corretora.', '#ff5c9a']].map(([t, d, c], i) => (
            <Reveal key={t} delay={i * 0.06}><div className="glass glass-hover h-full p-5" style={{ borderColor: c + '33' }}><div className="h-1 w-8 rounded" style={{ background: c }} /><h3 className="mt-4 font-semibold">{t}</h3><p className="mt-2 text-sm leading-relaxed text-dim">{d}</p></div></Reveal>))}
        </div>
      </section>

      <section className="py-10">
        <Reveal><div className="glass flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8" style={{ background: 'linear-gradient(135deg, rgba(61,220,132,.08), rgba(164,120,255,.06))' }}>
          <div><div className="text-xs uppercase tracking-[0.2em] text-dim">Plano mensal</div>
            <div className="mt-2 font-mono text-5xl font-bold text-executor">{brl(price)}<span className="text-base font-normal text-dim"> /mês</span></div>
            <p className="mt-3 max-w-md text-sm text-dim">Pix ou cartão · recorrente · cancele quando quiser pelo painel · acesso liberado por e-mail após a confirmação.</p></div>
          <a href="/checkout" className="rounded-lg bg-executor px-7 py-3.5 font-semibold text-bg no-underline hover:brightness-110">Assinar – {brl(price)}/mês</a>
        </div></Reveal>
      </section>

      <section className="py-10">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Perguntas frequentes</h2>
        <div className="mt-6 space-y-2">{FAQ.map(([q, a]) => (
          <details key={q} className="glass group p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">{q}<span className="text-dim transition group-open:rotate-45" aria-hidden>+</span></summary><p className="mt-3 text-sm leading-relaxed text-dim">{a}</p></details>))}</div>
      </section>

      <section className="mt-6 rounded-xl border border-filter/40 bg-filter/5 p-5 text-sm leading-relaxed text-filter">
        <b>AVISO DE RISCO.</b> Criptomoedas são ativos de alto risco e volatilidade. Você pode perder parte ou todo o capital. O robô opera automaticamente com dinheiro real e pode ter prejuízo, inclusive por falhas de corretora, API, conexão ou do próprio modelo. Resultados passados (inclusive backtests) não garantem resultados futuros. {APP_NAME} não é recomendação de investimento nem consultoria financeira. Opere apenas com valores que pode perder.
      </section>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-dim"><Logo /><div className="flex gap-4"><a href="/terms" className="text-dim">Termos de uso</a><a href="/privacy" className="text-dim">Privacidade (LGPD)</a></div></footer>
    </main>
  );
}
