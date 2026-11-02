import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Política de privacidade" };

export default function Privacy() {
  return (
    <LegalPage title="Política de privacidade" updated="02/11/2026">
      <p>Esta política explica como o SiteHunter AI trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).</p>
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Conta:</strong> nome, e-mail e senha (armazenada apenas como hash criptográfico).</li>
        <li><strong>Assinatura:</strong> status, datas e identificadores de pedidos recebidos da Kiwify. <strong>Não recebemos nem armazenamos dados de cartão.</strong></li>
        <li><strong>Uso:</strong> contagem de pesquisas e gerações, registros técnicos de segurança (ex.: tentativas de login, endereço IP de forma transitória para limitação de requisições).</li>
        <li><strong>Conteúdo:</strong> empresas salvas, projetos de sites, propostas e mensagens que você cria.</li>
      </ul>
      <h2>2. Dados de empresas</h2>
      <p>As informações de empresas (nome, endereço, telefone comercial, site) são dados comerciais públicos obtidos da Google Places API, de acordo com os termos dessa fonte. Elas são exibidas apenas para o usuário que fez a pesquisa e não são compartilhadas entre contas.</p>
      <h2>3. Finalidades e bases legais</h2>
      <ul>
        <li>Prestação do serviço contratado (execução de contrato).</li>
        <li>Segurança, prevenção a fraudes e cumprimento de obrigações legais e fiscais.</li>
        <li>Comunicações sobre a conta e a assinatura (execução de contrato).</li>
      </ul>
      <h2>4. Compartilhamento com operadores</h2>
      <ul>
        <li>Kiwify — processamento de pagamentos.</li>
        <li>Provedor de inteligência artificial (Anthropic) — dados públicos da empresa e preferências que você informa, para gerar textos.</li>
        <li>Google (Places API) — termos de pesquisa.</li>
        <li>Unsplash — termos de busca de imagens, quando você usa o banco de imagens.</li>
        <li>Provedor de hospedagem e de e-mail transacional.</li>
      </ul>
      <h2>5. Visitantes dos sites publicados</h2>
      <p>Os sites publicados não usam cookies de rastreamento. Contamos apenas o número de acessos, sem identificar visitantes. Os formulários de orçamento abrem o WhatsApp ou o e-mail da empresa; a mensagem não é armazenada pela Plataforma.</p>
      <h2>6. Retenção</h2>
      <p>Os dados da conta são mantidos enquanto ela existir. Após o vencimento da assinatura, os projetos são preservados pelo prazo informado nos Termos de Uso e depois excluídos. Registros de pagamento são guardados pelo prazo exigido pela legislação fiscal.</p>
      <h2>7. Seus direitos</h2>
      <p>Você pode, a qualquer momento, em “Minha conta”: acessar e baixar seus dados (portabilidade), corrigir seu nome e solicitar a exclusão da conta. Para outras solicitações (informação sobre compartilhamento, revogação de consentimento, oposição), entre em contato com o encarregado de dados pelo e-mail de suporte da plataforma.</p>
      <h2>8. Segurança</h2>
      <p>Usamos conexões HTTPS, senhas com hash bcrypt, cookies de sessão protegidos (HttpOnly), isolamento de dados por conta e limitação de requisições.</p>
      <p className="text-xs text-slate-500">Modelo inicial — revise com um advogado e inclua a identificação do controlador e o contato do encarregado (DPO) antes de lançar a plataforma.</p>
    </LegalPage>
  );
}
