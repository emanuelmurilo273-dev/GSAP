// Gera research/RESEARCH.md a partir de results/select.json e results/test.json
import { readFileSync, writeFileSync } from 'node:fs';
const sel = JSON.parse(readFileSync('research/results/select.json', 'utf8'));
const tst = JSON.parse(readFileSync('research/results/test.json', 'utf8'));
const f = (x: number | null, d = 2) => (x == null ? '—' : Number.isFinite(x) ? x.toFixed(d) : '∞');
const p = (x: number | null, d = 1) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);
const ok = (b: boolean) => (b ? '✅' : '❌');
const L: string[] = [];
const approved = tst.results.filter((r: any) => r.approved);

L.push('# Pesquisa de estratégia — relatório', '');
L.push(`Gerado em ${tst.ranAt.slice(0, 10)}. Scripts: \`research/download.ts\`, \`engine.ts\`, \`strategies.ts\`, \`run.ts\`, \`report.ts\`.`, '');
L.push('## Veredito', '');
L.push(approved.length
  ? `**${approved.length} estratégia(s) passaram em todos os critérios** (ver seção do teste final).`
  : '**NENHUMA estratégia passou nos critérios. Nada foi forçado, nenhum parâmetro foi reajustado depois de ver o teste, e o modo real para clientes permanece BLOQUEADO.**', '');
L.push('## Método', '');
L.push('- **Dados:** BTC, ETH e SOL × USDT, candles reais de `data-api.binance.vision`, 3 anos (2023-11-10 → 2026-11-09), 15m baixado e reamostrado para 1h e 4h (só candles completos).');
L.push('- **Divisão por tempo (mesmas datas nos 3 timeframes):** 60% treino · 20% validação · 20% teste final. Na fase de seleção o teste final **é removido da memória** (o script só carrega dados até o fim da validação).');
L.push('- **Walk-forward (dentro do treino):** otimiza em 9 meses, testa nos 3 seguintes, avança 3 meses.');
L.push('- **Seleção:** por (família, timeframe), os 3 melhores parâmetros do treino vão para a validação; vence o melhor na validação. Por família, escolhe-se o timeframe de melhor validação → 5 finalistas. Só então roda o teste final, **uma vez por finalista** (arquivo `results/test.lock.json` impede repetição).');
L.push('- **Objetivo de otimização:** fator de lucro (limitado a 3) × √(trades/30), exigindo ≥10 trades.');
L.push('- **Custos:** taxa 0,1% + slippage 0,05% por execução, sempre. Entrada na abertura do candle seguinte ao sinal; se stop e alvo caem no mesmo candle, vale o stop.');
L.push('- **Simulação:** long-only spot, 1 posição por par, 100% do capital do par por trade (a "força do sinal" não é mascarada por tamanho pequeno; a família 5 dimensiona por ATR arriscando 1%/trade). Portfólio = 3 pares com peso igual.');
L.push(`- **Orçamento de tentativas:** ${sel.trials} combinações de parâmetros avaliadas no treino (5 famílias × 3 timeframes). Quanto mais se tenta, maior a chance de um acerto casual — por isso há validação e teste separados.`);
L.push('- **Critérios de aprovação (teste final):** fator de lucro ≥ 1,3 · drawdown máx. do portfólio ≤ 20% · ≥ 100 trades · lucro em ≥ 2 dos 3 pares · Sharpe do portfólio > Sharpe do comprar-e-segurar no mesmo período.', '');

L.push('## 1. Teste final (uma única execução por estratégia)', '');
const t0 = tst.results[0];
L.push(`Período: ${t0.from} → ${t0.to} (≈ 20% mais recente dos dados).`, '');
L.push('| Estratégia | TF | Parâmetros | PF | DD máx. | Trades | Pares c/ lucro | Sharpe | Retorno | Resultado |', '|---|---|---|---|---|---|---|---|---|---|');
for (const r of tst.results) {
  L.push(`| ${r.name} | ${r.tf} | \`${JSON.stringify(r.params)}\` | ${f(r.test.pf)} | ${p(r.test.maxDD)} | ${r.test.trades} | ${r.checks.pairs.value}/3 | ${f(r.test.sharpe)} | ${p(r.test.ret)} | ${r.approved ? '**APROVADA**' : 'reprovada'} |`);
}
L.push('', `Referência — comprar e segurar (portfólio igual-peso, mesmo período): retorno ${p(t0.buyHold.ret)}, DD ${p(t0.buyHold.maxDD)}, Sharpe ${f(t0.buyHold.sharpe)}.`, '');
L.push('### Critérios, estratégia a estratégia', '', '| Estratégia | PF ≥ 1,3 | DD ≤ 20% | ≥ 100 trades | ≥ 2 pares c/ lucro | Sharpe > B&H |', '|---|---|---|---|---|---|');
for (const r of tst.results) {
  const c = r.checks;
  L.push(`| ${r.name} @${r.tf} | ${ok(c.pf.ok)} ${f(c.pf.value)} | ${ok(c.maxDD.ok)} ${p(c.maxDD.value)} | ${ok(c.trades.ok)} ${c.trades.value} | ${ok(c.pairs.ok)} ${c.pairs.value}/3 | ${ok(c.sharpe.ok)} ${f(c.sharpe.value)} vs ${f(r.buyHold.sharpe)} |`);
}
L.push('', '### Por par (teste final)', '', '| Estratégia | BTC | ETH | SOL |', '|---|---|---|---|');
for (const r of tst.results) L.push(`| ${r.name} @${r.tf} | ${r.perPair.map((x: any) => p(x.ret)).join(' | ')} |`);

L.push('', '## 2. Validação (20% do meio) — todas as 15 combinações', '', '| Família | TF | Parâmetros escolhidos no treino | Treino PF | Validação PF | Val. trades | Val. retorno | Val. DD | Walk-forward PF (OOS) | WF trades | WF folds lucrativos |', '|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of sel.rows) {
  const c = r.chosen;
  L.push(`| ${r.name} | ${r.tf} | \`${JSON.stringify(c.params)}\` | ${f(c.train.pf)} | ${f(c.val.pf)} | ${c.val.trades} | ${p(c.val.ret)} | ${p(c.val.maxDD)} | ${f(r.wf.pooledPf)} | ${r.wf.trades} | ${r.wf.profitableFolds}/${r.wf.folds.length} |`);
}
L.push('', '## 3. Os 3 melhores do treino de cada combinação (e como foram na validação)', '', '| Família | TF | Parâmetros | Treino PF | Treino trades | Validação PF | Val. trades |', '|---|---|---|---|---|---|---|');
for (const r of sel.rows) for (const c of r.candidates) L.push(`| ${r.family} | ${r.tf} | \`${JSON.stringify(c.params)}\` | ${f(c.train.pf)} | ${c.train.trades} | ${f(c.val.pf)} | ${c.val.trades} |`);

L.push('', '## 4. Folds do walk-forward (treino)', '');
for (const r of sel.rows) {
  L.push(`**${r.name} @${r.tf}**`, '', '| Otimização desde | Teste (OOS) | Parâmetros | OOS PF | OOS trades | OOS retorno |', '|---|---|---|---|---|---|');
  for (const x of r.wf.folds) L.push(`| ${x.isFrom} | ${x.oosFrom} → ${x.oosTo} | \`${JSON.stringify(x.params)}\` | ${f(x.oosPf)} | ${x.oosTrades} | ${p(x.oosRet)} |`);
  L.push('');
}

L.push('## Leitura honesta dos números', '');
L.push('- Na **validação**, as 15 combinações deram prejuízo (fator de lucro entre 0,16 e 0,93). No **teste final**, as 5 finalistas também (PF 0,74–1,00) e todas ficaram com Sharpe abaixo do comprar-e-segurar.');
L.push('- O walk-forward do treino mostrou PFs acima de 1 em alguns casos (especialmente 4h, com poucos trades). Esse ganho **não se repetiu** fora da amostra: é o padrão típico de ajuste ao passado.');
L.push('- Os períodos de validação e teste foram, em boa parte, de queda/lateralização do mercado cripto; estratégias só-compradas sofrem nesses regimes. Isso explica, mas **não justifica**, aprovar algo: o critério era robustez fora da amostra.');
L.push('- Limitações: 3 anos é pouco para estratégias de tendência (poucos ciclos); 4h gera poucos trades (a exigência de ≥100 trades é difícil de cumprir nesse timeframe em ~7 meses de teste); grades de parâmetros pequenas; sem short, sem derivativos; execução idealizada (sem fila/liquidez real).');
L.push('- **Não** foram feitas rodadas extras de ajuste após ver o teste final, e **não** é válido repetir o teste com outros parâmetros: o teste final desta rodada já está consumido. Para uma nova pesquisa seria preciso novos dados (período posterior) como novo teste final.');
L.push('', '## Consequência para o produto', '');
L.push(approved.length
  ? '- A estratégia aprovada deve virar o padrão do app (ver `STRATEGY_APPROVED`).'
  : '- Nenhuma estratégia aprovada ⇒ `STRATEGY_APPROVED=false`: **clientes não conseguem ligar o robô em conta real**. O robô continua disponível em testnet e na "conta do dono" (validação com valor pequeno), com aviso explícito. A estratégia padrão atual do app (nota técnica) **não** foi aprovada: seu backtest real foi negativo (ver README).');
writeFileSync('research/RESEARCH.md', L.join('\n') + '\n');
writeFileSync('research/approval.json', JSON.stringify({ approved: approved.length > 0, strategies: approved.map((a: any) => ({ family: a.family, tf: a.tf, params: a.params })), generatedAt: tst.ranAt }, null, 2));
console.log('RESEARCH.md gerado; aprovadas:', approved.length);
