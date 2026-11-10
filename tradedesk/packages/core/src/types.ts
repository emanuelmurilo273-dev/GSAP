export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type Timeframe = '15m' | '1h' | '4h';
export type ExchangeId = 'binance' | 'bybit' | 'mercado' | 'foxbit';
export type Quote = 'USDT' | 'BRL';

/** Todos os percentuais são frações (0.03 = 3%). */
export interface StrategyParams {
  minScore: number;
  stopPct: number;
  targetPct: number;
  /** distância do trailing stop (ativa quando o lucro passa de targetPct/2). 0 = desligado */
  trailingPct: number;
  positionPct: number;
  dailyLossPct: number;
  maxPositions: number;
  timeframe: Timeframe;
  /** volatilidade extrema: ATR14/preço acima disso => par descartado */
  maxVolPct: number;
}

export const DEFAULT_PARAMS: StrategyParams = {
  minScore: 0.7,
  stopPct: 0.03,
  targetPct: 0.06,
  trailingPct: 0.02,
  positionPct: 0.05,
  dailyLossPct: 0.05,
  maxPositions: 3,
  timeframe: '1h',
  maxVolPct: 0.03,
};

export const TF_MS: Record<Timeframe, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
};

export const EXCHANGES: Record<ExchangeId, { label: string; ccxt: string }> = {
  binance: { label: 'Binance', ccxt: 'binance' },
  bybit: { label: 'Bybit', ccxt: 'bybit' },
  mercado: { label: 'Mercado Bitcoin', ccxt: 'mercado' },
  foxbit: { label: 'Foxbit', ccxt: 'foxbit' },
};

/** Taxas por lado (fração). Foxbit: 0,25% maker / 0,50% taker nos mercados em R$ (tabela pública; pode cair com o volume do cliente). Usadas no backtest e quando a corretora não informa a taxa. */
export const EXCHANGE_FEES: Record<ExchangeId, { maker: number; taker: number }> = {
  binance: { maker: 0.001, taker: 0.001 }, bybit: { maker: 0.001, taker: 0.001 }, mercado: { maker: 0.003, taker: 0.007 }, foxbit: { maker: 0.0025, taker: 0.005 },
};
export const takerFee = (id: string): number => (EXCHANGE_FEES as Record<string, { taker: number }>)[id]?.taker ?? 0.001;
/** Cotação padrão de cada corretora (Foxbit só negocia em R$). */
export const EXCHANGE_QUOTE: Record<ExchangeId, Quote> = { binance: 'USDT', bybit: 'USDT', mercado: 'BRL', foxbit: 'BRL' };
export const isExchangeId = (x: string): x is ExchangeId => x === 'binance' || x === 'bybit' || x === 'mercado' || x === 'foxbit';

/** Mercado Bitcoin: desligado até haver como verificar a permissão de saque da chave. */
export const mercadoEnabled = () => process.env.ENABLE_MERCADO_BITCOIN === 'true';
/** Corretoras liberadas: EXCHANGES_ENABLED (ex.: "bybit" ou "bybit,binance"; a 1ª é a padrão na tela). Mercado Bitcoin só com ENABLE_MERCADO_BITCOIN=true. */
export const enabledExchangeIds = (): ExchangeId[] => {
  const raw = (process.env.EXCHANGES_ENABLED ?? 'foxbit').split(',').map((x) => x.trim().toLowerCase());
  const ids = raw.filter((x): x is ExchangeId => isExchangeId(x) && (x !== 'mercado' || mercadoEnabled()));
  if (mercadoEnabled() && !ids.includes('mercado') && process.env.EXCHANGES_ENABLED === undefined) ids.push('mercado');
  return ids.length ? ids : ['foxbit'];
};
/** Testnet (dinheiro de mentira) para Binance e Bybit: EXCHANGE_TESTNET=true (BINANCE_TESTNET continua valendo). */
export const testnetMode = () => process.env.EXCHANGE_TESTNET === 'true' || process.env.BINANCE_TESTNET === 'true';
/** Aprovação da estratégia pela pesquisa (research/RESEARCH.md). Sem aprovação, só testnet e conta do dono. */
export const strategyApproved = () => process.env.STRATEGY_APPROVED === 'true';
export const realModeAllowed = (isOwner: boolean) => testnetMode() || strategyApproved() || isOwner;

/** A VENDA só abre quando a estratégia está aprovada no teste fora da amostra (STRATEGY_APPROVED=true) E o dono liberou (SALES_OPEN=true). Até lá: lista de espera. */
export const salesOpen = () => strategyApproved() && process.env.SALES_OPEN === 'true';

export const RISK_TERMS_VERSION = '2026-11-01';

export interface TradeRow {
  id: string;
  user_id: string;
  symbol: string;
  status: 'open' | 'closed';
  qty: number;
  entry_price: number;
  cost: number;
  stop_price: number;
  target_price: number;
  peak_price: number;
  trailing_active: boolean;
  stop_order_id: string | null;
  entry_at: string;
  exit_price: number | null;
  exit_at: string | null;
  proceeds: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  exit_reason: string | null;
  score: number | null;
  analysis: string | null;
}

export interface SubscriptionRow {
  status: 'pending' | 'active' | 'overdue' | 'blocked' | 'canceled';
  paid_until: string | null;
  overdue_since: string | null;
  blocked_by_admin: boolean;
}

/** Acesso é decidido SEMPRE no servidor, a partir da tabela subscriptions. */
export function hasAccess(sub: SubscriptionRow | null | undefined, now = Date.now()): boolean {
  if (!sub || sub.blocked_by_admin) return false;
  if (sub.status === 'active' || sub.status === 'overdue') return true;
  if (sub.status === 'canceled' && sub.paid_until) return new Date(sub.paid_until).getTime() > now;
  return false;
}
