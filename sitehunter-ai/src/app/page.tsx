import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSettings, formatBRL } from "@/lib/settings";
import { buildSiteContent, fallbackCopy, getSegment } from "@/lib/site/templates";
import { renderSite } from "@/lib/site/render";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPrivateMode } from "@/lib/owner";
import { Scene3D } from "@/components/studio/Scene3D";
import { PreviewFrame } from "@/components/studio/PreviewFrame";

export const dynamic = "force-dynamic";

const features = [
  { icon: "🔎", title: "Descoberta por critérios", text: "Informe nicho, região, idioma e quantidade. A plataforma busca, remove duplicadas e verifica a presença digital de cada empresa." },
  { icon: "🧾", title: "Cada fato com sua fonte", text: "Confirmado, inferido ou não encontrado: cada dado mostra a origem, a confiança e a data. Você corrige o que precisar antes de gerar." },
  { icon: "🧭", title: "Oportunidades claras", text: "Sem site, só rede social, site fora do ar, sem HTTPS, não adaptado ao celular ou desatualizado, com a evidência de cada observação." },
  { icon: "✨", title: "Sites gerados com IA", text: "Estrutura, textos, cores e fontes adaptados ao segmento: restaurantes, barbearias, clínicas, oficinas, lojas e serviços." },
  { icon: "🎨", title: "Editor sem código", text: "Troque textos, imagens, cores e fontes, adicione ou remova seções e veja a versão para celular e computador." },
  { icon: "🚀", title: "Publicação com HTTPS", text: "Publique em um endereço próprio da plataforma com certificado SSL. Atualize ou despublique quando quiser." },
  { icon: "📄", title: "Propostas comerciais", text: "Gere propostas com seus preços e prazos, edite, copie o texto ou baixe em PDF." },
  { icon: "💬", title: "Abordagem em vários idiomas", text: "Assunto e mensagem em português e no idioma do lead, citando só fatos verificados. Copie ou exporte: nada é enviado automaticamente." },
];

const steps = [
  "Crie sua conta e assine o plano Premium.",
  "Escolha estado, cidade e segmento comercial.",
  "Revise as empresas encontradas e salve as que interessam.",
  "Clique em “Criar site com IA” e ajuste tudo no editor.",
  "Publique o site e gere a proposta comercial.",
  "Prepare a mensagem e entre em contato com o possível cliente.",
];

const faq = [
  { q: "Vocês garantem que vou vender sites?", a: "Não. O SiteHunter AI é uma ferramenta de prospecção e produção. Os resultados dependem do seu trabalho comercial, do mercado e de cada cliente — não prometemos ganhos." },
  { q: "Como vocês sabem que a empresa não tem site?", a: "Não sabemos com certeza. O filtro mostra empresas para as quais a fonte de dados (Google) não informa um site. A empresa pode ter um site que não foi cadastrado, por isso recomendamos verificar antes do contato." },
  { q: "Os dados das empresas são inventados?", a: "Nunca. Exibimos somente informações comerciais públicas retornadas pela fonte de dados. A IA também é instruída a não inventar depoimentos, avaliações, preços ou certificações." },
  { q: "O que acontece com os sites se eu cancelar?", a: "Ao cancelar a renovação você mantém o acesso até o fim do período já pago. Depois disso, os recursos Premium são suspensos e os sites publicados saem do ar (é exibida uma página de “temporariamente indisponível”). Seus projetos ficam preservados por 30 dias e podem ser exportados; ao renovar, os sites voltam ao ar automaticamente." },
  { q: "Posso levar o site do meu cliente para outra hospedagem?", a: "Sim. Você pode exportar os arquivos do site (HTML) a qualquer momento e hospedá-los onde preferir." },
  { q: "Posso usar um domínio próprio do cliente?", a: "Sim. Depois de publicar, conecte um domínio (ex.: www.empresa.com.br) apontando o DNS para a plataforma. O certificado SSL é emitido automaticamente." },
  { q: "As mensagens são enviadas automaticamente?", a: "Não. Nada é enviado sem a sua ação. A plataforma abre a conversa no WhatsApp com o texto pronto e você decide se envia. Não fazemos disparos em massa." },
  { q: "Como funciona o pagamento?", a: "O pagamento é processado pela Kiwify. Assim que a Kiwify confirma o pagamento, seu acesso Premium é liberado automaticamente." },
];

export default async function Landing() {
  // Produto privado: não existe página pública de vendas; quem chega aqui vai para o painel (ou para o login).
  if (isPrivateMode()) redirect((await getCurrentUser()) ? "/app" : "/login");
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const price = formatBRL(settings.priceCents);
  const demoCompany = { name: "Barbearia Exemplo", city: "Curitiba", neighborhood: "Centro", phone: null, address: "Endereço ilustrativo" };
  const seg = getSegment("barbearia");
  const demoHtml = renderSite(buildSiteContent(demoCompany, seg, fallbackCopy(demoCompany, seg)));

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[120px] animate-pulse-glow" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <a href="#recursos" className="hover:text-white">Recursos</a>
          <a href="#como-funciona" className="hover:text-white">Como funciona</a>
          <a href="#preco" className="hover:text-white">Preço</a>
          <a href="#faq" className="hover:text-white">Dúvidas</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/app" className="btn-primary">Abrir painel</Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Entrar</Link>
              <Link href="/cadastro" className="btn-primary hidden sm:inline-flex">Criar conta</Link>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="relative z-10 text-center lg:text-left">
            <span className="badge mb-6 border border-brand-500/30 bg-brand-500/10 text-brand-300 animate-fade-up">Estúdio de prospecção e criação de sites</span>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl animate-fade-up">
              Dados públicos entram.{" "}
              <span className="bg-gradient-to-r from-brand-400 via-cyan-glow to-[var(--color-signal)] bg-clip-text text-transparent">Uma prévia de site sai.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400 animate-fade-up [animation-delay:120ms] lg:mx-0">
              Encontre empresas com presença digital fraca, confira cada informação com a fonte, gere um site de demonstração personalizado e prepare uma abordagem honesta para revisar e enviar quando quiser.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start animate-fade-up [animation-delay:200ms]">
              <Link href={user ? "/app/leads" : "/cadastro"} className="btn-primary whitespace-nowrap px-6 py-3.5 text-base">{user ? "Abrir estúdio" : `Começar agora · ${price}/mês`}</Link>
              <a href="#demo" className="btn-secondary whitespace-nowrap px-6 py-3.5 text-base">Ver uma prévia</a>
            </div>
            <p className="mt-4 text-xs text-slate-500">Nada é enviado ou publicado sem a sua ação · Pagamento via Kiwify</p>
          </div>
          <Scene3D className="lg:ml-6" />
        </section>

        <section id="recursos" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Tudo o que você precisa para prospectar e entregar</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="card card-hover p-5">
                <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-xl ring-1 ring-brand-500/20">{f.icon}</div>
                <h3 className="font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Veja um site gerado pela plataforma</h2>
              <p className="mt-4 text-slate-400">Cada modelo é adaptado ao segmento e personalizado com os dados reais da empresa. Depois é só revisar no editor, publicar e apresentar ao cliente.</p>
              <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">Exemplo ilustrativo com uma empresa fictícia. Nenhum dado real foi usado nesta demonstração.</p>
            </div>
            <PreviewFrame srcDoc={demoHtml} title="Demonstração de site gerado" mode="3d" height={460} url="barbearia-exemplo · prévia" />
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Como funciona</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s} className="card flex items-start gap-4 p-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">{i + 1}</span>
                <p className="pt-1.5 text-slate-300">{s}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="preco" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-lg card relative overflow-hidden p-8">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
            <span className="badge bg-brand-500/15 text-brand-300">PREMIUM</span>
            <div className="mt-4 flex items-end gap-1">
              <span className="text-5xl font-extrabold text-white">{price}</span>
              <span className="pb-1.5 text-slate-400">/mês</span>
            </div>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
              {[
                `Até ${settings.maxSearchesPerMonth} pesquisas de empresas por mês`,
                `Até ${settings.maxGenerationsPerMonth} novas gerações de sites por mês`,
                `Até ${settings.maxPublishedSites} sites publicados ao mesmo tempo`,
                "Editor de sites, publicação e hospedagem incluídos",
                "Certificado SSL (HTTPS) e domínio próprio",
                "Propostas comerciais e mensagens de abordagem",
                "Exportação dos arquivos dos sites",
              ].map((i) => (
                <li key={i} className="flex gap-2"><span className="text-brand-400">✓</span>{i}</li>
              ))}
            </ul>
            <Link href={user ? "/app/assinatura" : "/cadastro"} className="btn-primary mt-8 w-full py-3.5 text-base">Começar agora — {price}/mês</Link>
            <p className="mt-3 text-center text-xs text-slate-500">Os limites podem ser ajustados conforme os custos das APIs e da hospedagem, com aviso prévio.</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white">Hospedagem dos sites</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Os sites ficam em endereços como <code className="text-brand-300">nome-da-empresa.sitehunter.app</code> com HTTPS. <strong className="text-slate-200">A hospedagem depende da sua assinatura ativa</strong>: se ela vencer, os sites saem do ar até a renovação. Você pode exportar os arquivos a qualquer momento para hospedá-los em outro lugar.</p>
          </div>
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white">Regras de cancelamento</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Cancele a renovação quando quiser pela Kiwify. O acesso continua até o fim do período pago. Após o vencimento, os recursos Premium são suspensos e os projetos ficam preservados por {settings.retentionDays} dias para recuperação ou exportação. Reembolsos seguem o Código de Defesa do Consumidor e a política da Kiwify.</p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">Perguntas frequentes</h2>
          <div className="mt-8 space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-white">
                  {f.q}
                  <span className="text-brand-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row">
          <Logo />
          <div className="flex gap-5">
            <Link href="/termos" className="hover:text-slate-300">Termos de uso</Link>
            <Link href="/privacidade" className="hover:text-slate-300">Política de privacidade</Link>
          </div>
          <span>© {new Date().getFullYear()} SiteHunter AI</span>
        </div>
      </footer>
    </div>
  );
}
