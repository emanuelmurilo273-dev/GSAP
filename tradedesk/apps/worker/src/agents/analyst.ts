import { llmReview, scoreAt, type Candle, type Score, type Series, type StrategyParams } from '@desk/core';

export interface Analysis {
  technical: Score;
  final: number;
  summary: string;
  llm: boolean;
}

/** 3 · ANALYST — nota técnica (EMA 9/21, RSI, MACD, volume, S/R) + resumo/ajuste do LLM. */
export async function analyze(symbol: string, c: Candle[], s: Series, p: StrategyParams): Promise<Analysis | null> {
  const i = c.length - 1;
  const technical = scoreAt(s, c, i, p);
  if (!technical) return null;
  // só gasta LLM quando a nota técnica já está perto do limite
  if (technical.score < p.minScore - 0.1) {
    return { technical, final: technical.score, summary: 'Nota técnica abaixo do limite; LLM não consultado.', llm: false };
  }
  const r = await llmReview(symbol, p.timeframe, technical);
  if (!r) return { technical, final: technical.score, summary: 'LLM indisponível — decisão só com a nota técnica.', llm: false };
  const final = Math.max(0, Math.min(1, technical.score + r.adjustment));
  return { technical, final: Math.round(final * 1000) / 1000, summary: r.summary, llm: true };
}
