-- Foxbit (e Bybit) como corretoras de cripto aceitas. A 001 só listava binance/mercado.
alter table public.exchange_accounts drop constraint if exists exchange_accounts_exchange_check;
alter table public.exchange_accounts add constraint exchange_accounts_exchange_check check (exchange in ('binance','bybit','mercado','foxbit'));

-- Trava de 5% do pico (cripto): maior patrimônio visto e motivo da pausa automática.
alter table public.bot_settings add column if not exists peak_equity numeric;
alter table public.bot_settings add column if not exists paused_reason text;

-- Estatísticas reais: toda operação guarda o ID das ordens na corretora e se foi em testnet (testnet NUNCA entra nas estatísticas).
alter table public.trades add column if not exists entry_order_id text;
alter table public.trades add column if not exists exit_order_id text;
alter table public.trades add column if not exists fees numeric;          -- taxas pagas (entrada + saída), na moeda de cotação
alter table public.trades add column if not exists testnet boolean not null default false;

-- Lista de espera (a venda só abre com estratégia aprovada). LGPD: guarda só o e-mail e o aceite; o titular pode pedir exclusão.
create table if not exists public.waitlist (
  email text primary key, created_at timestamptz not null default now(), consent_at timestamptz not null default now(), ip text
);
alter table public.waitlist enable row level security;   -- sem policy: só o service_role (servidor) acessa
