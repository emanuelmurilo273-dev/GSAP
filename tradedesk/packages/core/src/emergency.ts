import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from './crypto';
import { makeExchange, type Ex } from './exchange';
import { closeAllPositions, log } from './trading';

/**
 * DESLIGAMENTO DE EMERGÊNCIA. Faz, nesta ordem e sem parar se uma etapa falhar:
 *  1) liga a chave geral (`kill_switch`): o worker e o conector da B3 passam a RECUSAR qualquer operação;
 *  2) desliga TODOS os robôs de cripto e a B3 (volta ao simulador, trava o real, manda PARAR TUDO ao conector);
 *  3) vende a mercado as posições abertas de cada cliente (cripto) e manda o conector zerar a B3.
 * Religar exige `releaseKillSwitch` (só o dono, e só com estratégia aprovada).
 */
export interface HaltDeps { makeEx?: (id: any, creds: { apiKey: string; secret: string }) => Ex | Promise<Ex> }

export async function haltEverything(sb: SupabaseClient, reason: string, deps: HaltDeps = {}) {
  const out = { users: 0, closed: 0, failed: 0, errors: [] as string[] };
  await sb.from('app_settings').upsert({ key: 'kill_switch', value: { on: true, at: new Date().toISOString(), reason } });          // 1) trava primeiro
  await sb.from('bot_settings').update({ bot_enabled: false, paused_reason: `EMERGÊNCIA: ${reason}` }).neq('user_id', '00000000-0000-0000-0000-000000000000');
  await sb.from('b3_settings').update({ mode: 'sim', enabled: false, real_unlocked: false, real_limited: false, real_locked: true, real_locked_reason: `EMERGÊNCIA: ${reason}`, updated_at: new Date().toISOString() }).eq('id', 1);
  await sb.from('b3_commands').insert({ command: 'panic' });
  const { data: open } = await sb.from('trades').select('user_id').eq('status', 'open');
  const users = [...new Set((open ?? []).map((t: any) => t.user_id as string))];
  out.users = users.length;
  for (const uid of users) {                                                                                                         // 3) zera cada cliente
    try {
      const { data: acc } = await sb.from('exchange_accounts').select('*').eq('user_id', uid).maybeSingle();
      if (!acc) { out.failed++; out.errors.push(`${uid}: sem corretora conectada`); continue; }
      const creds = { apiKey: decrypt(acc.api_key_enc), secret: decrypt(acc.api_secret_enc) };
      const ex = await (deps.makeEx ?? ((id, c) => makeExchange(id, c)))(acc.exchange, creds);
      await ex.loadMarkets();
      await log(sb, uid, 'risk', 'error', `EMERGÊNCIA: ${reason}. Fechando todas as posições.`);
      const r = await closeAllPositions(sb, ex, uid, 'emergência');
      out.closed += r.closed; out.failed += r.errors.length; out.errors.push(...r.errors.map((e) => `${uid}: ${e}`));
    } catch (e: any) { out.failed++; out.errors.push(`${uid}: ${String(e?.message ?? e).slice(0, 120)}`); }
  }
  await sb.from('b3_logs').insert({ level: 'error', agent: 'risk', message: `EMERGÊNCIA: ${reason}. Tudo desligado; conector manda zerar.` });
  return out;
}

/** A chave geral está ligada? (padrão do banco: SIM, depois da migration 010 de emergência). */
export async function killSwitchOn(sb: SupabaseClient): Promise<{ on: boolean; reason?: string }> {
  const { data } = await sb.from('app_settings').select('value').eq('key', 'kill_switch').maybeSingle();
  const v = data?.value as { on?: boolean; reason?: string } | undefined;
  return { on: !!v?.on, reason: v?.reason };
}

/** Religar: só com aprovação (cripto: STRATEGY_APPROVED; B3: b3_approval) e frase do dono. Religar NÃO liga robô nenhum: só tira a trava geral. */
export async function releaseKillSwitch(sb: SupabaseClient, o: { approved: boolean; phrase: string }): Promise<{ ok: boolean; error?: string }> {
  if (!o.approved) return { ok: false, error: 'Nenhuma estratégia foi aprovada no teste fora da amostra: o real continua desligado.' };
  if (o.phrase !== 'RELIGAR APÓS APROVAÇÃO') return { ok: false, error: 'Digite exatamente "RELIGAR APÓS APROVAÇÃO".' };
  await sb.from('app_settings').upsert({ key: 'kill_switch', value: { on: false, at: new Date().toISOString() } });
  return { ok: true };
}
