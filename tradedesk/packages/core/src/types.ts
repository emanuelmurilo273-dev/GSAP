export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type Timeframe = '15m' | '1h' | '4h';
export type ExchangeId = 'binance' | 'mercado';
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
  mercado: { label: 'Mercado Bitcoin', ccxt: 'mercado' },
};

/** Mercado Bitcoin: desligado até haver como verificar a permissão de saque da chave. */
export const mercadoEnabled = () => process.env.ENABLE_MERCADO_BITCOIN === 'true';
export const enabledExchangeIds = (): ExchangeId[] => (mercadoEnabled() ? ['binance', 'mercado'] : ['binance']);
export const testnetMode = () => process.env.BINANCE_TESTNET === 'true';
/** Aprovação da estratégia pela pesquisa (research/RESEARCH.md). Sem aprovação, só testnet e conta do dono. */
export const strategyApproved = () => process.env.STRATEGY_APPROVED === 'true';
export const realModeAllowed = (isOwner: boolean) => testnetMode() || strategyApproved() || isOwner;

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
