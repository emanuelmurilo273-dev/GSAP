import { APP_NAME, Logo } from '@/components/ui';

export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 text-sm leading-relaxed"><Logo />
      <h1 className="text-xl text-neon-green">Política de Privacidade (LGPD)</h1>
      <p className="text-dim">Modelo-base: revise com seu advogado/DPO e preencha o contato do encarregado.</p>
      <h2 className="text-neon-blue">Dados que tratamos</h2>
      <p>Nome, e-mail e CPF/CNPJ (cobrança e emissão fiscal — base legal: execução de contrato e obrigação legal); chaves de API da corretora, criptografadas (execução do contrato); registros de operações, logs e configurações do robô; endereço IP no aceite do termo de risco (prova do consentimento).</p>
      <h2 className="text-neon-blue">Finalidade e compartilhamento</h2>
      <p>Usamos os dados para operar o robô na sua conta, cobrar a assinatura e enviar e-mails do serviço. Compartilhamos o mínimo necessário com operadores: Supabase (banco/autenticação), Asaas (pagamentos), Resend (e-mail), a corretora que você conectou e o provedor de LLM (que recebe apenas indicadores técnicos do par, nunca suas chaves, saldo ou dados pessoais). Não vendemos dados.</p>
      <h2 className="text-neon-blue">Seus direitos</h2>
      <p>Você pode solicitar confirmação, acesso, correção, portabilidade, anonimização e exclusão dos dados, além de revogar consentimentos, pelo e-mail de contato do {APP_NAME}. Ao cancelar e pedir exclusão, removemos chaves e dados pessoais, ressalvada a retenção exigida por lei (ex.: registros fiscais e de pagamento).</p>
      <h2 className="text-neon-blue">Segurança</h2>
      <p>Chaves criptografadas com AES-256-GCM, acesso por link mágico, políticas RLS no banco, validação de assinatura nos webhooks e minimização de dados.</p>
    </main>
  );
}
