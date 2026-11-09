-- Conta do dono, auditoria, saúde do worker, alertas e validação de 30 dias.

create table public.audit_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  actor uuid,
  email text,
  action text not null,
  detail jsonb not null default '{}',
  ip text
);
create index audit_log_ts on public.audit_log(ts desc);

create table public.worker_heartbeat (
  id int primary key default 1 check (id = 1),
  ts timestamptz not null default now(),
  info jsonb not null default '{}'
);

create table public.alerts_sent (
  key text primary key,
  ts timestamptz not null default now()
);

alter table public.audit_log enable row level security;
alter table public.worker_heartbeat enable row level security;
alter table public.alerts_sent enable row level security;

-- Owner = role 'owner' E sessão com 2FA verificado (aal2). Magic link sozinho (aal1) não basta.
create or replace function public.is_owner() returns boolean
language sql security definer set search_path = public stable as
$$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      and exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') $$;

create policy audit_read on public.audit_log for select using (public.is_owner());
create policy heartbeat_read on public.worker_heartbeat for select using (public.is_owner());
-- alerts_sent: sem policy (somente service_role)

-- Repasse Pix pode ficar aguardando autorização no Asaas
alter table public.payouts drop constraint if exists payouts_status_check;
alter table public.payouts add column if not exists asaas_transfer_id text;
