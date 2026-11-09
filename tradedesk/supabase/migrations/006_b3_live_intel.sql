-- Ao vivo (snapshot), calendário de notícias, decisões do robô, versões de estratégia (campeão x desafiante) e operações-sombra.
create table public.b3_live (
  id int primary key default 1 check (id = 1),
  ts timestamptz not null default now(),
  data jsonb not null default '{}'
);

create table public.b3_events (
  id bigint generated always as identity primary key,
  starts_at timestamptz not null,
  title text not null,
  impact text not null default 'alto' check (impact in ('alto','medio')),
  created_at timestamptz not null default now()
);
create index b3_events_starts on public.b3_events(starts_at);

create table public.b3_decisions (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  symbol text not null,
  decision text not null check (decision in ('entrou','nao_entrou')),
  reason text not null,
  regime text,
  prob numeric,
  version text,
  details jsonb not null default '{}'
);
create index b3_decisions_ts on public.b3_decisions(ts desc);

create table public.strategy_versions (
  id bigint generated always as identity primary key,
  name text not null,
  role text not null check (role in ('champion','challenger','retired')),
  config jsonb not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);
create unique index one_champion on public.strategy_versions(role) where role = 'champion';
insert into public.strategy_versions (name, role, config, notes) values ('Base (EMA 9/21, sem camadas)', 'champion', '{}', 'versão inicial: todas as camadas de inteligência DESLIGADAS');

create table public.b3_shadow_trades (
  id bigint generated always as identity primary key,
  version_id bigint not null references public.strategy_versions(id) on delete cascade,
  day date not null,
  symbol text not null,
  side text not null,
  opened_at timestamptz,
  closed_at timestamptz,
  pnl numeric not null,
  reason text,
  source text not null default 'mt5'   -- 'internal' = preços artificiais: NUNCA conta para promover versão
);
create index b3_shadow_version_day on public.b3_shadow_trades(version_id, day);

alter table public.b3_live enable row level security;
alter table public.b3_events enable row level security;
alter table public.b3_decisions enable row level security;
alter table public.strategy_versions enable row level security;
alter table public.b3_shadow_trades enable row level security;
create policy b3_live_read on public.b3_live for select using (public.is_owner());
create policy b3_events_read on public.b3_events for select using (public.is_owner());
create policy b3_decisions_read on public.b3_decisions for select using (public.is_owner());
create policy versions_read on public.strategy_versions for select using (public.is_owner());
create policy shadow_read on public.b3_shadow_trades for select using (public.is_owner());
