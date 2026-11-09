-- Liberação do dono com limites rígidos: modo REAL sem estratégia aprovada ("limitado"). Os tetos são aplicados no painel E no conector.
alter table public.b3_settings add column if not exists real_limited boolean not null default false;
