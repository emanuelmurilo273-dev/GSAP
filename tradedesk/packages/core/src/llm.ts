import type { Score } from './strategy';

export interface LlmReview {
  /** ajuste na nota: limitado a [-0.15, +0.05]. O LLM pode barrar/reduzir, quase nunca inflar. */
  adjustment: number;
  summary: string;
}

const PROMPT = (symbol: string, tf: string, s: Score) => `Você é o Analyst de uma mesa de trading spot (somente compra, long-only).
Par: ${symbol} · timeframe: ${tf}
Nota técnica (0-1): ${s.score}
Componentes: ${JSON.stringify(s.parts)}
Indicadores no último candle fechado: ${JSON.stringify(s.snapshot)}

Resuma o contexto em no máximo 2 frases em português e ajuste a nota se houver risco que os números não capturam
(ex.: RSI esticado, volume fraco, resistência colada, divergência). Responda APENAS JSON:
{"adjustment": <número entre -0.15 e 0.05>, "summary": "<texto>"}`;

function parse(text: string): LlmReview | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const adj = Number(j.adjustment);
    if (!Number.isFinite(adj) || typeof j.summary !== 'string') return null;
    return { adjustment: Math.min(0.05, Math.max(-0.15, adj)), summary: j.summary.slice(0, 400) };
  } catch {
    return null;
  }
}

/** Retorna null se o LLM estiver indisponível — o chamador segue só com a nota técnica e registra o aviso. */
export async function llmReview(symbol: string, tf: string, s: Score): Promise<LlmReview | null> {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;
  const provider = process.env.LLM_PROVIDER ?? 'anthropic';
  try {
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: PROMPT(symbol, tf, s) }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const j: any = await r.json();
      return parse(j?.choices?.[0]?.message?.content ?? '');
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? 'claude-haiku-5-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: PROMPT(symbol, tf, s) }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const j: any = await r.json();
    return parse(j?.content?.[0]?.text ?? '');
  } catch {
    return null;
  }
}
