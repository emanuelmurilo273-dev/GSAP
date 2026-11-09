import ccxt, { type Exchange } from 'ccxt';
import { EXCHANGES, TF_MS, type Candle, type ExchangeId, type Timeframe } from './types';

export type Creds = { apiKey: string; secret: string };
export type Ex = Exchange;

export function makeExchange(id: ExchangeId, creds?: Creds): Ex {
  const meta = EXCHANGES[id];
  if (!meta) throw new Error(`corretora não suportada: ${id}`);
  const Cls = (ccxt as unknown as Record<string, new (o: object) => Ex>)[meta.ccxt];
  // Dados públicos (backtest, landing): endpoint "vision" da Binance, que não sofre o bloqueio geográfico (HTTP 451)
  // do api.binance.com em IPs dos EUA (Vercel). Operações com chave continuam no endpoint oficial.
  const publicOverride = id === 'binance' && !creds ? { urls: { api: { public: 'https://data-api.binance.vision/api/v3' } } } : {};
  return new Cls({ enableRateLimit: true, timeout: 20_000, options: { adjustForTimeDifference: true, ...(id === 'binance' ? { fetchMarkets: { types: ['spot'] } } : {}) }, ...publicOverride, ...creds });
}

export type KeyCheck =
  | { ok: true; permissions: Record<string, unknown>; verified: boolean; note?: string }
  | { ok: false; reason: string };

/**
 * Valida a chave NA HORA.
 *  - Binance: lê as restrições reais da chave (account/apiRestrictions). Recusa se tiver
 *    saque (enableWithdrawals) ou se NÃO tiver permissão de trade spot.
 *  - Mercado Bitcoin: a API não permite consultar as permissões da chave. Confirmamos que a
 *    chave funciona (consulta de saldo) e exigimos declaração expressa do cliente de que
 *    a chave NÃO tem saque (verified=false). Veja README.
 */
export async function validateKeys(id: ExchangeId, creds: Creds, attestNoWithdraw: boolean): Promise<KeyCheck> {
  const ex = makeExchange(id, creds);
  try {
    if (id === 'binance') {
      const fn = (ex as any).sapiGetAccountApiRestrictions;
      if (typeof fn !== 'function') return { ok: false, reason: 'Não foi possível consultar as permissões da chave (versão do CCXT).' };
      const r = await fn.call(ex);
      if (r.enableWithdrawals) return { ok: false, reason: 'Chave RECUSADA: tem permissão de SAQUE. Crie outra chave só com "Spot & Margin Trading".' };
      if (!r.enableSpotAndMarginTrading) return { ok: false, reason: 'Chave sem permissão de trade. Ative "Enable Spot & Margin Trading".' };
      await ex.fetchBalance();
      return {
        ok: true,
        verified: true,
        permissions: {
          trade: true,
          withdraw: false,
          ipRestrict: !!r.ipRestrict,
          universalTransfer: !!r.permitsUniversalTransfer,
        },
        note: r.ipRestrict ? undefined : 'Recomendado: restrinja a chave aos IPs do servidor na Binance.',
      };
    }
    // Mercado Bitcoin
    if (!attestNoWithdraw) return { ok: false, reason: 'Confirme que a chave NÃO possui permissão de saque.' };
    await ex.fetchBalance();
    return { ok: true, verified: false, permissions: { trade: 'unverified', withdraw: 'attested-false' }, note: 'A Mercado Bitcoin não expõe as permissões da chave; baseamos na sua declaração.' };
  } catch (e: any) {
    return { ok: false, reason: `Chave inválida ou corretora indisponível: ${String(e?.message ?? e).slice(0, 200)}` };
  }
}

/** Candles históricos paginados (dados públicos reais). */
export async function fetchHistory(ex: Ex, symbol: string, tf: Timeframe, days: number): Promise<Candle[]> {
  const step = TF_MS[tf];
  const now = Date.now();
  let since = now - days * 86_400_000;
  const out = new Map<number, Candle>();
  for (let guard = 0; guard < 400 && since < now; guard++) {
    const rows = (await ex.fetchOHLCV(symbol, tf, since, 1000)) as number[][];
    if (!rows?.length) break;
    for (const r of rows) out.set(r[0], { t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] });
    const lastT = rows[rows.length - 1][0];
    if (lastT + step <= since) break;
    since = lastT + step;
  }
  const arr = [...out.values()].sort((a, b) => a.t - b.t);
  // descarta o candle ainda em formação
  if (arr.length && arr[arr.length - 1].t + step > now) arr.pop();
  return arr;
}

export async function fetchRecent(ex: Ex, symbol: string, tf: Timeframe, limit = 200): Promise<Candle[]> {
  const rows = (await ex.fetchOHLCV(symbol, tf, undefined, limit)) as number[][];
  const arr = rows.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] }));
  if (arr.length && arr[arr.length - 1].t + TF_MS[tf] > Date.now()) arr.pop(); // só candles fechados
  return arr;
}

/** Saldo real da corretora: total na moeda de cotação + posições abertas marcadas a mercado. */
export async function fetchPortfolio(ex: Ex, quote: string) {
  const bal = await ex.fetchBalance();
  const total = (bal.total ?? {}) as unknown as Record<string, number>;
  const holdings: { asset: string; amount: number; value: number }[] = [];
  let equity = total[quote] ?? 0;
  if (total[quote]) holdings.push({ asset: quote, amount: total[quote], value: total[quote] });
  for (const [asset, amount] of Object.entries(total)) {
    if (asset === quote || !amount || amount <= 0) continue;
    try {
      const t = await ex.fetchTicker(`${asset}/${quote}`);
      const value = amount * (t.last ?? 0);
      if (value >= 1) { equity += value; holdings.push({ asset, amount, value }); }
    } catch { /* ativo sem par na moeda de cotação: ignora */ }
  }
  return { equity, free: ((bal.free ?? {}) as unknown as Record<string, number>)[quote] ?? 0, holdings };
}
