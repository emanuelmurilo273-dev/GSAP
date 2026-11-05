import Link from "next/link";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { env } from "@/lib/env";
import { aiConfigured } from "@/lib/ai";
import { isPrivateMode } from "@/lib/owner";
import { CITIES } from "@/lib/br/cities";

type Row = { name: string; what: string; state: "on" | "off" | "partial"; status: string; how?: string; coverage?: string };

const BADGE = { on: "bg-emerald-500/15 text-emerald-200", off: "bg-slate-500/15 text-slate-300", partial: "bg-amber-500/15 text-amber-200" } as const;
const LABEL = { on: "Funcionando", off: "Desligado · requer chave", partial: "Funcionando com limite" } as const;

export default async function SettingsPage() {
  const user = await pageUser();
  const commonsOff = process.env.IMAGE_SEARCH === "off" || process.env.COMMONS_SEARCH === "off";
  const search: Row[] = [
    { name: "Municípios do Brasil", what: "Lista de estados e cidades para a busca", state: "on", status: `${CITIES.length.toLocaleString("pt-BR")} municípios + DF embutidos no app (base aberta derivada do IBGE, licença MIT).`, coverage: "Todo o Brasil" },
    { name: "OpenStreetMap (Nominatim)", what: "Descoberta de empresas: nome, categoria, endereço, telefone, site, redes, horários e WhatsApp quando cadastrados", state: env.osmContactEmail ? "on" : "partial", status: env.osmContactEmail ? `Gratuito, sem chave. Contato informado ao serviço: ${env.osmContactEmail}.` : "Gratuito, sem chave. Recomendado definir OSM_CONTACT_EMAIL (política de uso do serviço).", how: env.osmContactEmail ? undefined : "OSM_CONTACT_EMAIL=seu@email.com", coverage: "Todo o Brasil; o cadastro depende de voluntários e varia muito por cidade. Limite de 1 consulta por segundo" + (env.nominatimUrl ? ` · instância própria: ${env.nominatimUrl}` : "") },
    { name: "Google Maps (Places API New)", what: "Descoberta com cobertura maior, horários e fotos publicadas pela própria empresa", state: env.googlePlacesKey ? "on" : "off", status: env.googlePlacesKey ? "Chave configurada no servidor." : "Sem chave: a aba Buscar usa o OpenStreetMap.", how: "GOOGLE_PLACES_API_KEY=… (Google Cloud, “Places API (New)”, serviço pago)", coverage: "Todo o Brasil" },
    { name: "Verificação do site da empresa", what: "Lê só a página inicial pública (após o robots.txt): links wa.me, número indicado como WhatsApp, redes, fotos e descrição", state: "on", status: "Ativa. Sites de órgãos públicos ou que não citam o nome da empresa não confirmam nada." },
  ];
  const images: Row[] = [
    { name: "Wikimedia Commons", what: "Fotos reais com licença livre (busca pelo nome e perto do endereço)", state: commonsOff ? "off" : "on", status: commonsOff ? "Desligado por configuração." : "Ativo, sem chave. Entram como candidatas para você aprovar, com autor e licença." },
    { name: "Openverse", what: "Fotos ilustrativas com licença compatível (sempre identificadas como ilustrativas)", state: env.imageSearchDisabled ? "off" : env.openverseToken ? "on" : "partial", status: env.openverseToken ? "Token configurado." : "Sem chave, com limite por endereço de rede.", how: env.openverseToken ? undefined : "OPENVERSE_TOKEN=… (opcional, aumenta o limite)" },
    { name: "Unsplash", what: "Banco de fotos ilustrativas alternativo", state: env.unsplashKey ? "on" : "off", status: env.unsplashKey ? "Chave configurada (substitui o Openverse)." : "Opcional.", how: "UNSPLASH_ACCESS_KEY=… (gratuita)" },
    { name: "Instagram e Facebook", what: "Fotos dos perfis da empresa", state: "off", status: "Não coletadas: exigem login e os termos dessas redes proíbem coleta automática. Peça as fotos à empresa e adicione no editor." },
  ];
  const other: Row[] = [
    { name: "Textos com IA (Claude)", what: "Textos dos sites e das abordagens", state: aiConfigured() ? "on" : "off", status: aiConfigured() ? "Chave configurada." : "Sem chave: o app usa textos-modelo por setor, sem fatos inventados.", how: "ANTHROPIC_API_KEY=…" },
    { name: "WhatsApp", what: "Abordagens", state: "on", status: "O app só monta o link wa.me com o texto preenchido; você abre, revisa e envia. Não há envio automático nem verificação de conta pelo WhatsApp (isso exigiria mandar mensagens)." },
    { name: "3D dos sites (three.js)", what: "Vitrine 3D das prévias", state: "on", status: "Servido pelo próprio app (licença MIT); funciona sem chave." },
    { name: "Painel privado", what: "Acesso ao app", state: "on", status: isPrivateMode() ? `Modo privado: só a conta proprietária (${env.ownerEmail ?? user.email}) entra. Sem cadastro público.` : "Modo multiusuário (ACCESS_MODE=saas)." },
  ];
  const Section = ({ title, rows }: { title: string; rows: Row[] }) => (
    <section className="card p-5 sm:p-6">
      <h2 className="font-semibold text-white">{title}</h2>
      <ul className="mt-4 divide-y divide-white/5">
        {rows.map((r) => (
          <li key={r.name} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="min-w-0">
              <p className="font-medium text-white">{r.name}</p>
              <p className="text-xs text-slate-500">{r.what}</p>
              <p className="mt-1 text-sm text-slate-300">{r.status}</p>
              {r.coverage && <p className="mt-1 text-xs text-slate-400">Cobertura: {r.coverage}</p>}
              {r.how && r.state !== "on" && <p className="mt-1 text-xs text-slate-500">Para ativar: <code className="rounded bg-white/5 px-1.5 py-0.5 text-slate-300">{r.how}</code></p>}
            </div>
            <span className={`badge shrink-0 ${BADGE[r.state]}`}>{LABEL[r.state]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <>
      <PageHeader title="Configurações" subtitle="Fontes de pesquisa, imagens e integrações. O que aparece como funcionando foi lido agora da configuração do servidor." />
      <div className="space-y-6">
        <Section title="Fontes de pesquisa" rows={search} />
        <Section title="Imagens" rows={images} />
        <Section title="Outras integrações" rows={other} />
        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold text-white">Como adicionar uma chave</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
            <li>Instalou com o instalador de dois cliques? Abra o arquivo <code className="text-slate-200">.env.local-docker</code> na pasta <code className="text-slate-200">sitehunter-ai</code>. Instalação manual: arquivo <code className="text-slate-200">.env</code>.</li>
            <li>Adicione a linha indicada acima (ex.: <code className="text-slate-200">GOOGLE_PLACES_API_KEY=sua-chave</code>) e salve.</li>
            <li>Rode o instalador de novo (ou reinicie o app). As chaves ficam só no servidor; nunca aparecem nesta tela.</li>
          </ol>
        </section>
        <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <div><h2 className="font-semibold text-white">Sua conta</h2><p className="text-sm text-slate-400">{user.name} · {user.email}</p></div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/conta" className="btn-secondary px-3 py-2 text-sm">Senha e dados da conta</Link>
            {!isPrivateMode() && <Link href="/app/assinatura" className="btn-secondary px-3 py-2 text-sm">Assinatura</Link>}
            <Link href="/app/propostas" className="btn-ghost px-3 py-2 text-sm">Propostas comerciais</Link>
          </div>
        </section>
      </div>
    </>
  );
}
