-- Origem dos dados: 'mt5' (conta DEMO/REAL do MetaTrader 5) ou 'internal' (simulador interno com preços ARTIFICIAIS).
-- Só 'mt5' conta para os "20 pregões no simulador" exigidos antes do modo REAL.
alter table public.b3_trades add column if not exists source text not null default 'mt5';
alter table public.b3_status add column if not exists source text;
alter table public.b3_sessions add column if not exists source text not null default 'mt5';
alter table public.b3_sessions drop constraint if exists b3_sessions_pkey;
alter table public.b3_sessions add primary key (day, mode, source);
