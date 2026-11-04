import { Logo } from "@/components/Logo";

export const metadata = { title: "SiteHunterBot · SiteHunter AI" };

export default function BotPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-slate-300">
      <Logo />
      <h1 className="mt-10 text-3xl font-bold text-white">SiteHunterBot</h1>
      <p className="mt-4">O SiteHunterBot faz verificações pontuais de presença digital quando um usuário do SiteHunter AI revisa uma empresa. Ele:</p>
      <ul className="mt-4 list-disc space-y-2 pl-6">
        <li>consulta o <code>/robots.txt</code> antes de qualquer acesso e respeita as regras para <code>SiteHunterBot</code> e <code>*</code> (RFC 9309);</li>
        <li>lê somente a página inicial pública. Não segue links, não envia formulários e não acessa áreas com login, paywall ou CAPTCHA;</li>
        <li>faz no máximo uma requisição por verificação, com tempo e tamanho limitados;</li>
        <li>registra apenas sinais técnicos (HTTPS, adaptação ao celular, título, ano no rodapé) e contatos comerciais genéricos publicados (ex.: contato@).</li>
      </ul>
      <p className="mt-6">Para bloquear: adicione ao robots.txt</p>
      <pre className="mt-2 rounded-xl bg-white/5 p-4 text-sm">User-agent: SiteHunterBot{"\n"}Disallow: /</pre>
    </main>
  );
}
