-- Day trade B3 (WIN/WDO) via conector MT5. Tudo é do DONO; escrita só pelo conector e rotas de servidor (service_role).

create table public.b3_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,                       -- robô ligado (pode abrir posições)
  mode text not null default 'sim' check (mode in ('sim','real')),
  real_unlocked boolean not null default false,                 -- 1ª trava do modo real (a 2ª fica na máquina do conector)
  real_unlocked_at timestamptz,
  symbols text[] not null default '{WIN,WDO}',
  profile text not null default 'conservador' check (profile in ('conservador','moderado','agressivo')),
  risk_per_trade_brl numeric not null default 50 check (risk_per_trade_brl between 1 and 5000),
  max_contracts int not null default 2 check (max_contracts between 1 and 50),
  daily_loss_brl numeric not null default 150 check (daily_loss_brl between 10 and 50000),
  daily_target_brl numeric check (daily_target_brl is null or daily_target_brl between 10 and 100000),
  max_trades_per_day int not null default 6 check (max_trades_per_day between 1 and 50),
  stop_points_win numeric not null default 150 check (stop_points_win between 20 and 1000),
  stop_points_wdo numeric not null default 5 check (stop_points_wdo between 1 and 50),
  rr numeric not null default 1.5 check (rr between 0.5 and 5),
  open_from text not null default '09:05' check (open_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  open_until text not null default '17:00' check (open_until ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  flat_at text not null default '17:30' check (flat_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  updated_at timestamptz not null default now()
);
insert into public.b3_settings (id) values (1) on conflict do nothing;

create table public.b3_status (
  id int primary key default 1 check (id = 1),
  connector_ts timestamptz,
  connector_version text,
  state text,
  last_error text,
  account_mode text,
  mode_wanted text,
  account_login text,
  account_server text,
  balance numeric, equity numeric, margin_free numeric,
  day_pnl numeric default 0,
  trades_today int default 0,
  halted boolean default false,
  contracts jsonb default '{}',
  positions jsonb default '[]'
);

create table public.b3_commands (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  command text not null check (command in ('panic','close_all','refresh')),
  status text not null default 'pending' check (status in ('pending','done','error')),
  result text,
  handled_at timestamptz
);

create table public.b3_logs (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  level text not null, agent text not null, message text not null, meta jsonb not null default '{}'
);
create index b3_logs_ts on public.b3_logs(ts desc);

create table public.b3_trades (
  id bigint generated always as identity primary key,
  mode text not null, root text not null, contract text not null, side text not null,
  volume numeric not null, price_open numeric not null, sl numeric, tp numeric, ticket bigint,
  stop_points numeric,
  opened_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','closed')),
  price_close numeric, pnl numeric, closed_at timestamptz, close_reason text
);
create index b3_trades_opened on public.b3_trades(opened_at desc);

create table public.b3_sessions (
  day date not null, mode text not null,
  start_equity numeric not null, pnl numeric not null default 0, trades int not null default 0,
  halted boolean not null default false, halt_reason text, active_minutes int not null default 0,
  primary key (day, mode)
);

create table public.b3_equity (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(), mode text not null, equity numeric not null
);
create index b3_equity_ts on public.b3_equity(ts desc);

alter table public.b3_settings enable row level security;
alter table public.b3_status enable row level security;
alter table public.b3_commands enable row level security;
alter table public.b3_logs enable row level security;
alter table public.b3_trades enable row level security;
alter table public.b3_sessions enable row level security;
alter table public.b3_equity enable row level security;
create policy b3_settings_read on public.b3_settings for select using (public.is_owner());
create policy b3_status_read on public.b3_status for select using (public.is_owner());
create policy b3_commands_read on public.b3_commands for select using (public.is_owner());
create policy b3_logs_read on public.b3_logs for select using (public.is_owner());
create policy b3_trades_read on public.b3_trades for select using (public.is_owner());
create policy b3_sessions_read on public.b3_sessions for select using (public.is_owner());
create policy b3_equity_read on public.b3_equity for select using (public.is_owner());
