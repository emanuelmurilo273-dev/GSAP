import { APP_NAME, Logo } from '@/components/ui';

export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 text-sm leading-relaxed"><Logo />
      <h1 className="text-xl text-neon-green">Termos de Uso</h1>
      <p className="text-dim">Modelo-base: revise com seu advogado antes de operar comercialmente.</p>
      <h2 className="text-neon-blue">1. O serviço</h2>
      <p>{APP_NAME} é uma ferramenta de software (SaaS) que envia ordens automáticas à conta de corretora do próprio cliente, usando chave de API com permissão de negociação. Não somos corretora, não custodiamos recursos, não recebemos nem guardamos dinheiro do cliente e não prestamos consultoria ou recomendação de investimento.</p>
      <h2 className="text-neon-blue">2. Risco</h2>
      <p>Operar criptomoedas envolve alto risco, inclusive de perda total do capital. O robô pode ter prejuízo. Resultados passados, inclusive backtests, não garantem resultados futuros. Falhas de corretora, rede, API, liquidez, slippage e do próprio software podem causar perdas. O cliente é o único responsável pelo capital que destina ao robô e pelas configurações escolhidas.</p>
      <h2 className="text-neon-blue">3. Chaves de API</h2>
      <p>O cliente deve criar chave apenas com permissão de negociação e sem permissão de saque. Chaves com saque são recusadas quando a corretora permite verificar. As chaves são armazenadas criptografadas (AES-256-GCM). O cliente pode revogá-las a qualquer momento na corretora.</p>
      <h2 className="text-neon-blue">4. Pagamento e cancelamento</h2>
      <p>A assinatura é mensal e recorrente (Pix ou cartão via Asaas). O cancelamento pode ser feito a qualquer momento no painel, interrompendo cobranças futuras; o acesso permanece até o fim do período já pago. Mensalidade vencida há 3 dias pausa o robô e bloqueia o acesso, sem prejuízo da cobrança devida. Posições abertas permanecem sob responsabilidade do cliente.</p>
      <h2 className="text-neon-blue">5. Limitação de responsabilidade</h2>
      <p>No limite da lei, o serviço é fornecido “como está”, sem garantia de resultado, disponibilidade ininterrupta ou ausência de erros. Não respondemos por perdas de mercado decorrentes do uso do robô.</p>
      <h2 className="text-neon-blue">6. Foro</h2>
      <p>Aplica-se a lei brasileira. Foro do domicílio do consumidor quando aplicável.</p>
    </main>
  );
}
