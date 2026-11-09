-- NEONDESK · esquema inicial. Rode no SQL Editor do Supabase (ou `supabase db push`).
-- Princípio: o cliente (anon/authenticated) só LÊ os próprios dados. Toda escrita sensível
-- (assinatura, chaves, configurações, liga/desliga do robô) passa por rotas de servidor com service_role.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'user' check (role in ('user','owner')),
  created_at timestamptz not null default now()
);

create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  cpf_cnpj text not null,
  asaas_customer_id text,
  asaas_subscription_id text unique,
  asaas_payment_id text,
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  asaas_customer_id text,
  asaas_subscription_id text unique,
  status text not null default 'pending' check (status in ('pending','active','overdue','blocked','canceled')),
  value numeric(12,2) not null,
  paid_until timestamptz,
  overdue_since timestamptz,
  blocked_by_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.payments (
  asaas_payment_id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  asaas_subscription_id text,
  value numeric(12,2),
  status text,
  billing_type text,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  created_at timestamptz not null default now()
);

create table public.webhook_events (
  id text primary key,
  received_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  value numeric(12,2) not null,
  status text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table public.exchange_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  exchange text not null check (exchange in ('binance','mercado')),
  api_key_enc text not null,
  api_secret_enc text not null,
  key_hint text not null,
  permissions jsonb not null default '{}',
  verified boolean not null default false,
  attested_no_withdraw boolean not null default false,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bot_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bases text[] not null default '{BTC,ETH,SOL}',
  quote text not null default 'USDT' check (quote in ('USDT','BRL')),
  position_pct numeric not null default 0.05 check (position_pct > 0 and position_pct <= 0.25),
  stop_pct numeric not null default 0.03 check (stop_pct >= 0.003 and stop_pct <= 0.2),
  target_pct numeric not null default 0.06 check (target_pct >= 0.005 and target_pct <= 0.5),
  trailing_pct numeric not null default 0.02 check (trailing_pct >= 0 and trailing_pct <= 0.2),
  daily_loss_pct numeric not null default 0.05 check (daily_loss_pct > 0 and daily_loss_pct <= 0.3),
  min_score numeric not null default 0.7 check (min_score >= 0.5 and min_score <= 0.95),
  timeframe text not null default '1h' check (timeframe in ('15m','1h','4h')),
  max_positions int not null default 3 check (max_positions between 1 and 10),
  bot_enabled boolean not null default false,
  risk_accepted_at timestamptz,
  risk_terms_version text,
  risk_accepted_ip text,
  backtest_done_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  status text not null default 'open' check (status in ('open','closed')),
  qty numeric not null,
  entry_price numeric not null,
  cost numeric not null,
  stop_price numeric not null,
  target_price numeric not null,
  peak_price numeric not null,
  trailing_active boolean not null default false,
  stop_order_id text,
  entry_at timestamptz not null default now(),
  exit_price numeric,
  exit_at timestamptz,
  proceeds numeric,
  pnl numeric,
  pnl_pct numeric,
  exit_reason text,
  score numeric,
  analysis text
);
create index trades_user_status on public.trades(user_id, status, entry_at desc);
-- nunca preço médio: no máximo 1 posição aberta por par
create unique index trades_one_open_per_symbol on public.trades(user_id, symbol) where status = 'open';

create table public.bot_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null default now(),
  agent text not null,
  level text not null check (level in ('info','warn','error','trade','refuse')),
  message text not null,
  meta jsonb not null default '{}'
);
create index bot_logs_user_ts on public.bot_logs(user_id, ts desc);

create table public.agent_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  agent text not null,
  state text not null,
  detail text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, agent)
);

create table public.daily_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  start_equity numeric not null,
  halted boolean not null default false,
  halted_reason text,
  primary key (user_id, day)
);

create table public.symbol_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  last_candle_ts bigint not null default 0,
  last_score numeric,
  primary key (user_id, symbol)
);

create table public.equity_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null default now(),
  equity numeric not null,
  quote text not null,
  primary key (user_id, ts)
);

create table public.backtests (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'user' check (kind in ('user','official')),
  user_id uuid references auth.users(id) on delete cascade,
  exchange text not null,
  symbol text not null,
  days int not null,
  timeframe text not null,
  params jsonb not null,
  metrics jsonb not null,
  equity jsonb not null,
  data_from timestamptz not null,
  data_to timestamptz not null,
  created_at timestamptz not null default now()
);
create index backtests_kind on public.backtests(kind, created_at desc);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

-- ---------- RLS ----------
create or replace function public.is_owner() returns boolean
language sql security definer set search_path = public stable as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') $$;

alter table public.profiles enable row level security;
alter table public.checkouts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.payouts enable row level security;
alter table public.exchange_accounts enable row level security;   -- sem policy: ninguém lê via API pública
alter table public.bot_settings enable row level security;
alter table public.trades enable row level security;
alter table public.bot_logs enable row level security;
alter table public.agent_status enable row level security;
alter table public.daily_state enable row level security;
alter table public.symbol_state enable row level security;
alter table public.equity_snapshots enable row level security;
alter table public.backtests enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_owner());
create policy subs_read on public.subscriptions for select using (user_id = auth.uid() or public.is_owner());
create policy pay_read on public.payments for select using (user_id = auth.uid() or public.is_owner());
create policy settings_read on public.bot_settings for select using (user_id = auth.uid() or public.is_owner());
create policy trades_read on public.trades for select using (user_id = auth.uid() or public.is_owner());
create policy logs_read on public.bot_logs for select using (user_id = auth.uid() or public.is_owner());
create policy agents_read on public.agent_status for select using (user_id = auth.uid());
create policy daily_read on public.daily_state for select using (user_id = auth.uid());
create policy equity_read on public.equity_snapshots for select using (user_id = auth.uid());
create policy bt_read on public.backtests for select using (user_id = auth.uid() or kind = 'official' or public.is_owner());
create policy payouts_read on public.payouts for select using (public.is_owner());
create policy app_settings_read on public.app_settings for select using (key = 'plan_price' or public.is_owner());
-- escritas: somente service_role (rotas de servidor e worker). Nenhuma policy de insert/update/delete.

-- Realtime para o dashboard ao vivo
alter publication supabase_realtime add table public.bot_logs, public.agent_status, public.trades;

-- Para virar dono: após criar sua conta, rode
--   update public.profiles set role = 'owner' where email = 'seu@email.com';
