import Link from "next/link";
import { Logo } from "@/components/Logo";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Logo />
      <article className="card mt-8 p-7 sm:p-10 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 text-sm leading-relaxed text-slate-300">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-xs text-slate-500">Última atualização: {updated}</p>
        {children}
      </article>
      <p className="mt-6 text-center text-sm"><Link href="/" className="text-brand-300">Voltar ao início</Link></p>
    </div>
  );
}
