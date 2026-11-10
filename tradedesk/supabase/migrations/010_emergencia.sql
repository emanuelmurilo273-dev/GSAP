-- EMERGÊNCIA (perdas reais): chave geral LIGADA, todos os robôs desligados, B3 no simulador e real travado.
-- O worker de cripto e o conector da B3 recusam operar enquanto kill_switch.on = true. Só o dono religa (com estratégia aprovada).
insert into public.app_settings (key, value) values ('kill_switch', jsonb_build_object('on', true, 'at', now(), 'reason', 'Perdas reais: autópsia e nova pesquisa pendentes'))
  on conflict (key) do update set value = excluded.value;
update public.bot_settings set bot_enabled = false, paused_reason = 'EMERGÊNCIA: perdas reais — desligado até a nova pesquisa aprovar';
update public.b3_settings set mode = 'sim', enabled = false, real_unlocked = false, real_limited = false, real_locked = true,
  real_locked_reason = 'EMERGÊNCIA: perdas reais — desligado até a nova pesquisa aprovar', updated_at = now() where id = 1;
