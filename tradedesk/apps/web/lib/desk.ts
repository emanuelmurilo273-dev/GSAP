/** Normaliza o texto de uma recusa em um motivo curto (para contar "Por que foram descartados"). */
export function reasonOf(msg: string): string {
  const m = msg.toLowerCase();
  const table: [RegExp, string][] = [[/spread alto/, 'Spread alto'], [/liquidez baixa|volume baixo/, 'Liquidez baixa'], [/volatilidade extrema|agitado demais|volátil/, 'Volatilidade extrema'], [/lateral/, 'Mercado lateral'],
    [/not[ií]cia|nova york|copom|payroll|cpi/, 'Notícia próxima'], [/nota .*<|nota <|< 0[.,]7|probabilidade/, 'Nota abaixo do mínimo'], [/já há posição|posição aberta/, 'Já há posição aberta'], [/limite de .* posições/, 'Limite de posições'],
    [/operações por dia|limite de operações/, 'Limite de operações do dia'], [/stop técnico|risco permitido|não comporta|sobra só/, 'Risco não cabe'], [/preços parados|sem cotação/, 'Sem cotação'], [/regime/, 'Regime bloqueado']];
  for (const [rx, label] of table) if (rx.test(m)) return label;
  return 'Outros';
}

