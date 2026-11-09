-- PROTEÇÃO IMEDIATA (diagnóstico de perdas): volta ao SIMULADOR, trava o modo real e reduz o limite de perda ao perfil Conservador.
-- A trava `real_locked` só é aberta pelo dono, no painel (Saúde do robô), depois de aprovar o DIAGNOSTICO.md. O conector também a respeita.
alter table public.b3_settings add column if not exists real_locked boolean not null default true;
alter table public.b3_settings add column if not exists real_locked_reason text;

update public.b3_settings set
  mode = 'sim', real_unlocked = false, real_limited = false,
  real_locked = true, real_locked_reason = 'Travado até o diagnóstico de perdas (DIAGNOSTICO.md) ser aprovado pelo dono.',
  profile = 'conservador',
  daily_loss_brl = least(daily_loss_brl, 100),            -- limite do perfil Conservador
  risk_per_trade_brl = least(risk_per_trade_brl, 50),
  max_contracts = least(max_contracts, 1),
  max_trades_per_day = least(max_trades_per_day, 3),
  rr = greatest(rr, 1.5),                                  -- relação risco/retorno mínima 1:1,5
  open_from = case when open_from < '09:15' then '09:15' else open_from end,   -- nada nos primeiros 15 min
  updated_at = now()
where id = 1;

-- Novos campos da operação, para a autópsia e para o botão "por quê?"
alter table public.b3_trades add column if not exists fees numeric;          -- corretagem + emolumentos pagos (R$)
alter table public.b3_trades add column if not exists gross_pnl numeric;     -- resultado antes dos custos
alter table public.b3_trades add column if not exists price_signal numeric;  -- preço visto na hora da decisão (mede a derrapagem)
alter table public.b3_trades add column if not exists regime text;
alter table public.b3_trades add column if not exists atr_pts numeric;
alter table public.b3_trades add column if not exists why text;              -- explicação em português simples
