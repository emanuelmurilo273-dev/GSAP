import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { apiOwner } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `Você é o Analyst de uma mesa de day trade de mini índice (WIN) e mini dólar (WDO) na B3.
Seu único papel é EXPLICAR o contexto do dia em português simples, em no máximo 8 linhas: abertura e gap, regime do mercado, notícias próximas, o que o robô fez e por quê.
Regras: você NÃO decide entradas, NÃO recomenda comprar nem vender, NÃO prevê preço e NÃO sugere mudar configurações de risco.
Use apenas os dados fornecidos; se algo não foi fornecido, diga "sem dados". Nunca invente números, notícias ou horários.`;

/** Resumo do contexto do dia por LLM. Só EXPLICA: nenhuma ordem depende dele. Usa o SDK oficial da Anthropic. */
export async function POST() {
  const g = await apiOwner();
  if (!g.ok) return g.res;
  const key = process.env.LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'Configure LLM_API_KEY (chave da Anthropic) no .env para usar o Analyst.' }, { status: 503 });
  if ((process.env.LLM_PROVIDER ?? 'anthropic') !== 'anthropic') return NextResponse.json({ error: 'O Analyst usa o Claude: defina LLM_PROVIDER=anthropic.' }, { status: 503 });
  const { admin } = g.data;
  const now = Date.now();
  const [st, settings, dec, ev, live, trades] = await Promise.all([
    admin.from('b3_status').select('state,day_pnl,trades_today,halted,contracts,account_mode,source').eq('id', 1).maybeSingle(),
    admin.from('b3_settings').select('mode,enabled,symbols,open_from,open_until,flat_at,daily_loss_brl').eq('id', 1).maybeSingle(),
    admin.from('b3_decisions').select('ts,symbol,decision,reason,regime,prob').order('ts', { ascending: false }).limit(15),
    admin.from('b3_events').select('starts_at,title,impact').gte('starts_at', new Date(now - 3600_000).toISOString()).lte('starts_at', new Date(now + 24 * 3600_000).toISOString()).order('starts_at'),
    admin.from('b3_live').select('data').eq('id', 1).maybeSingle(),
    admin.from('b3_trades').select('contract,side,pnl,close_reason,closed_at').eq('status', 'closed').order('closed_at', { ascending: false }).limit(10),
  ]);
  // abertura/gap a partir dos candles de 5 min do snapshot (se houver)
  let abertura: unknown = 'sem dados';
  const sym = (live.data?.data as any)?.symbols;
  const first = sym ? Object.keys(sym)[0] : null;
  const m5: number[][] | undefined = first ? sym[first]?.bars?.M5 : undefined;
  if (m5?.length) {
    const lastDay = Math.floor(m5[m5.length - 1][0] / 86400);
    const today = m5.filter((b) => Math.floor(b[0] / 86400) === lastDay);
    const prev = m5.filter((b) => Math.floor(b[0] / 86400) < lastDay);
    abertura = { simbolo: first, abertura_hoje: today[0]?.[1], ultimo_preco: m5[m5.length - 1][4], fechamento_anterior: prev.length ? prev[prev.length - 1][4] : 'sem dados',
      gap_pct: prev.length && today[0] ? Number((((today[0][1] / prev[prev.length - 1][4]) - 1) * 100).toFixed(3)) : 'sem dados' };
  }
  const context = { agora_iso: new Date(now).toISOString(), modo: settings.data, estado: st.data, abertura_e_gap: abertura, decisoes_recentes: dec.data, eventos_proximos_24h: ev.data, ultimas_operacoes: trades.data };
  try {
    const client = new Anthropic({ apiKey: key });
    const resp = await client.beta.messages.create({
      model: process.env.ANALYST_MODEL ?? 'claude-opus-5-5',
      max_tokens: 1500,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',          // se um classificador de segurança recusar, o servidor tenta o modelo de reserva na mesma chamada
      system: SYSTEM,
      messages: [{ role: 'user', content: `Dados do momento (JSON):\n${JSON.stringify(context)}\n\nExplique o contexto do dia em até 8 linhas.` }],
    } as any);
    if ((resp as any).stop_reason === 'refusal') return NextResponse.json({ error: 'O modelo recusou gerar este resumo.' }, { status: 502 });
    const text = (resp.content as any[]).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const value = { text, at: new Date().toISOString(), model: resp.model };
    await admin.from('app_settings').upsert({ key: 'b3_analyst', value });
    return NextResponse.json(value);
  } catch (e: any) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: 'Chave da Anthropic inválida.' }, { status: 502 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'Limite de uso da API atingido; tente em instantes.' }, { status: 429 });
    return NextResponse.json({ error: `Falha ao consultar o modelo: ${String(e?.message ?? e).slice(0, 160)}` }, { status: 502 });
  }
}
