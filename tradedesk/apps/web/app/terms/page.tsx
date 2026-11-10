import { APP_NAME, Logo } from '@/components/ui';

export const metadata = { title: 'Termos de uso' };

export default function Terms() {
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="pt-2 text-lg font-semibold text-executor">{children}</h2>;
  return (
    <main className="mx-auto max-w-3xl space-y-3 px-4 py-8 text-sm leading-relaxed"><Logo />
      <h1 className="text-3xl font-semibold tracking-tight">Termos de uso</h1>
      <p className="text-dim">Versão 2026-11. Este texto é um modelo-base e <b>deve ser revisado por advogado</b> (inclusive quanto à regulação de serviços de investimento pela CVM e à oferta de criptoativos) antes da venda.</p>
      <H>1. O serviço</H>
      <p>{APP_NAME} é um software que envia ordens automáticas para a conta de corretora do próprio cliente: na B3 (mini índice e mini dólar) por um conector instalado em computador ou VPS do cliente, usando o MetaTrader 5; e em criptoativos por chave de API sem permissão de saque. O app não custodia dinheiro, não recebe depósitos e não oferece recomendação de investimento, consultoria nem gestão de carteira.</p>
      <H>2. Risco</H>
      <p>Operações em renda variável podem gerar perdas, inclusive a perda total do valor alocado. Resultados passados não garantem resultados futuros. Backtests são simulações com dados históricos. O robô pode ter prejuízo, e stops podem executar com derrapagem (slippage), principalmente em mercados rápidos.</p>
      <H>3. Chaves e acessos</H>
      <p>O cliente deve criar chaves de API apenas com permissão de leitura e negociação, sem saque. O login do MetaTrader 5 fica criptografado no computador/VPS do cliente e não é enviado ao app. O cliente é responsável por manter seus acessos seguros e pode revogá-los a qualquer momento.</p>
      <H>4. Proteções do robô</H>
      <p>O robô aplica limite de perda diário, parada após duas perdas seguidas, stop em cada ordem, risco máximo por operação, zeragem da B3 às 17:30 e pausa automática se a conta cair 5% do pico. Essas proteções reduzem, mas não eliminam, o risco.</p>
      <H>5. Resultados publicados</H>
      <p>A página de resultados mostra o histórico completo das operações reais do próprio robô, sem filtro de períodos. Os números do cliente são calculados somente a partir de operações reais com ID de ordem na corretora.</p>
      <H>6. Pagamento, cancelamento e inadimplência</H>
      <p>A assinatura é mensal (Pix ou cartão via Asaas) e pode ser cancelada a qualquer momento no painel, sem multa. Em caso de inadimplência o acesso é bloqueado e o robô é pausado; posições já abertas mantêm o stop na corretora.</p>
      <H>7. Disponibilidade e limitação de responsabilidade</H>
      <p>O serviço é fornecido “como está”, sem garantia de resultado ou de funcionamento ininterrupto. Falhas de corretora, internet, API ou software podem causar perdas. No limite da lei, a responsabilidade é limitada ao valor pago pela assinatura nos últimos 3 meses, salvo dolo ou o que a lei não permitir limitar.</p>
      <H>8. Foro</H>
      <p>Aplica-se a lei brasileira. Foro do domicílio do consumidor, quando aplicável.</p>
    </main>
  );
}
