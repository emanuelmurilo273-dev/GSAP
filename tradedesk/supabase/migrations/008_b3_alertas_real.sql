-- Alertas ao dono (e-mail): cada operação, limites, queda do conector, volta automática ao simulador, resumo diário. O conector só ENFILEIRA; quem envia é o servidor (cron).
create table if not exists public.b3_alerts (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  kind text not null,                       -- trade_open | trade_close | limit | real_revert | connector_down | summary | info
  title text not null, body text not null default '',
  sent_at timestamptz
);
create index if not exists b3_alerts_unsent on public.b3_alerts(ts) where sent_at is null;
alter table public.b3_alerts enable row level security;
drop policy if exists b3_alerts_owner_read on public.b3_alerts;
create policy b3_alerts_owner_read on public.b3_alerts for select using (public.is_owner());
