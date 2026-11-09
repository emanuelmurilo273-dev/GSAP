import { RISK_TERMS_VERSION, realModeAllowed, testnetMode } from './types';

/** O que falta para o cliente poder LIGAR o robô (lista vazia = pode). Usado pela API e testado. */
export function enableBlockers(i: {
  account: { verified: boolean; attested_no_withdraw: boolean } | null;
  settings: { backtest_done_at: string | null; risk_accepted_at: string | null; risk_terms_version: string | null } | null;
  isOwner: boolean;
}): string[] {
  const m: string[] = [];
  if (!realModeAllowed(i.isOwner)) m.push('modo real bloqueado: nenhuma estratégia foi aprovada na pesquisa (use o testnet)');
  if (!i.account || !(i.account.verified || i.account.attested_no_withdraw)) m.push('conectar a corretora');
  if (!i.settings?.backtest_done_at) m.push('rodar o backtest com a configuração atual');
  if (!i.settings?.risk_accepted_at || i.settings.risk_terms_version !== RISK_TERMS_VERSION) m.push('aceitar o termo de risco');
  return m;
}
export { testnetMode };
