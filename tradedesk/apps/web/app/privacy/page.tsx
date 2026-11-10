import { APP_NAME, Logo } from '@/components/ui';

export const metadata = { title: 'Privacidade (LGPD)' };

export default function Privacy() {
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="pt-2 text-lg font-semibold text-executor">{children}</h2>;
  return (
    <main className="mx-auto max-w-3xl space-y-3 px-4 py-8 text-sm leading-relaxed"><Logo />
      <h1 className="text-3xl font-semibold tracking-tight">Política de privacidade (LGPD)</h1>
      <p className="text-dim">Versão 2026-11. Modelo-base: revise com advogado e preencha o controlador e o contato do encarregado (DPO) antes da venda.</p>
      <H>1. Que dados {APP_NAME} trata</H>
      <p>E-mail e nome; CPF/CNPJ (apenas para a cobrança no Asaas); chave de API da corretora (guardada criptografada com AES-256, sem permissão de saque); registros das operações do robô na conta do cliente (ativo, horários, preços, resultado, ID da ordem); logs técnicos e de auditoria; e, na lista de espera, só o e-mail e o aceite.</p>
      <H>2. Para quê</H>
      <p>Executar o serviço contratado, calcular as estatísticas do cliente, cobrar a assinatura, enviar avisos de operação, limite e conexão, e cumprir obrigações legais. Base legal: execução de contrato, consentimento (lista de espera e avisos opcionais), cumprimento de obrigação legal e legítimo interesse (segurança e prevenção a fraudes).</p>
      <H>3. O que NÃO fazemos</H>
      <p>Não recebemos nem guardamos seu dinheiro, não pedimos permissão de saque, não enviamos o login do MetaTrader 5 para servidores do app e não vendemos dados. A página pública de resultados mostra apenas números agregados das contas do próprio robô, sem dados pessoais de clientes.</p>
      <H>4. Compartilhamento</H>
      <p>Somente com operadores necessários: hospedagem e banco de dados (Supabase e provedor do app), pagamento (Asaas), e-mail (Resend), corretoras onde o cliente conectou a conta. Alguns operadores podem processar dados fora do Brasil, com as garantias previstas na LGPD.</p>
      <H>5. Seus direitos</H>
      <p>Acesso, correção, portabilidade (extrato em CSV), anonimização, eliminação, informação sobre compartilhamento e revogação do consentimento, a qualquer momento, pelo contato abaixo. Dados fiscais e de auditoria podem ser mantidos pelo prazo legal.</p>
      <H>6. Segurança e retenção</H>
      <p>Chaves criptografadas, acesso do administrador com 2FA e log de auditoria. Os dados são mantidos enquanto a conta existir e pelos prazos legais depois do cancelamento.</p>
      <H>7. Contato</H>
      <p>Controlador e encarregado: <b>[preencher: razão social, CNPJ e e-mail do DPO]</b>.</p>
    </main>
  );
}
