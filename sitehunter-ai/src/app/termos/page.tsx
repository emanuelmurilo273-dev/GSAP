import { LegalPage } from "@/components/legal/LegalPage";
import { getSettings, formatBRL } from "@/lib/settings";

export const metadata = { title: "Termos de uso" };
export const dynamic = "force-dynamic";

export default async function Terms() {
  const s = await getSettings();
  return (
    <LegalPage title="Termos de uso" updated="02/11/2026">
      <p>Estes termos regulam o uso da plataforma SiteHunter AI (“Plataforma”). Ao criar uma conta, você declara ter lido e aceito estes termos e a Política de Privacidade.</p>
      <h2>1. O serviço</h2>
      <p>A Plataforma oferece ferramentas para pesquisar empresas a partir de dados comerciais públicos, gerar e editar sites com auxílio de inteligência artificial, publicá-los em endereços da Plataforma, preparar propostas comerciais e mensagens de abordagem.</p>
      <p><strong>Não garantimos resultados financeiros.</strong> As vendas dependem do seu trabalho, do mercado e de cada cliente.</p>
      <h2>2. Plano e pagamento</h2>
      <ul>
        <li>Plano Premium: {formatBRL(s.priceCents)} por mês, cobrado pela Kiwify, conforme a modalidade de assinatura configurada no produto.</li>
        <li>Limites atuais: {s.maxSearchesPerMonth} pesquisas e {s.maxGenerationsPerMonth} gerações de sites por mês e {s.maxPublishedSites} sites publicados ao mesmo tempo. Os limites podem ser ajustados conforme os custos das APIs e da hospedagem, com aviso prévio.</li>
        <li>Cada assinatura é individual. É proibido compartilhar contas ou usar meios automatizados para contornar os limites.</li>
      </ul>
      <h2>3. Cancelamento, suspensão e retenção</h2>
      <ul>
        <li>Você pode cancelar a renovação a qualquer momento pela Kiwify. O acesso continua até o fim do período já pago.</li>
        <li>Após o vencimento sem renovação{s.graceDays ? ` (e ${s.graceDays} dia(s) de carência)` : ""}, os recursos Premium são suspensos e <strong>os sites publicados saem do ar</strong>, exibindo uma página de indisponibilidade temporária.</li>
        <li>Os projetos são preservados por {s.retentionDays} dias após a suspensão. Nesse período você pode exportar os arquivos dos sites. Se o pagamento for confirmado, a conta e os sites elegíveis são reativados automaticamente.</li>
        <li>Após esse prazo, os projetos e sites podem ser excluídos definitivamente, ressalvadas as obrigações legais de guarda de registros.</li>
        <li>Reembolsos e chargebacks revogam o acesso imediatamente. O direito de arrependimento (art. 49 do CDC) é exercido pela Kiwify.</li>
      </ul>
      <h2>4. Sites dos seus clientes</h2>
      <p>A hospedagem dos sites depende da manutenção da sua assinatura. A Plataforma não garante que um site permaneça publicado após o cancelamento ou vencimento. Informe seus clientes sobre isso. Os arquivos do site podem ser exportados para outra hospedagem a qualquer momento.</p>
      <h2>5. Uso responsável e proibições</h2>
      <ul>
        <li>Use os dados de empresas apenas para contato comercial legítimo, conforme a LGPD, os termos do Google e as regras do WhatsApp.</li>
        <li>É proibido enviar mensagens em massa, spam ou insistir com quem pediu para não ser contatado.</li>
        <li>Não publique conteúdo falso, enganoso, ilegal, que viole direitos de terceiros (marcas, imagens, textos) ou que se passe por uma empresa sem a autorização dela.</li>
        <li>Revise todo conteúdo gerado por IA antes de publicar. Não acrescente depoimentos, avaliações, preços ou certificações sem confirmação.</li>
        <li>Use apenas imagens próprias, autorizadas ou de bancos com licença apropriada.</li>
      </ul>
      <p>Contas que violarem estas regras podem ser suspensas.</p>
      <h2>6. Responsabilidades</h2>
      <p>Você é responsável pelo conteúdo que publica e pelas negociações com seus clientes. A Plataforma emprega esforços razoáveis para manter o serviço disponível, mas não garante disponibilidade ininterrupta.</p>
      <h2>7. Alterações</h2>
      <p>Estes termos podem ser atualizados. Alterações relevantes serão comunicadas com antecedência pelo e-mail cadastrado.</p>
      <p className="text-xs text-slate-500">Modelo inicial — revise com um advogado e inclua razão social, CNPJ, endereço e foro antes de lançar a plataforma.</p>
    </LegalPage>
  );
}
