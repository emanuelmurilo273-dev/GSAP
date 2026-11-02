import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { formatBRL } from "@/lib/settings";

export default async function ProposalsPage() {
  const user = await pageUser();
  const proposals = await prisma.proposal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { company: { select: { name: true } } } });
  return (
    <>
      <PageHeader title="Propostas comerciais" subtitle="Crie propostas a partir de um site em “Meus sites → Editor → Vendas”." />
      {!proposals.length ? (
        <div className="card p-10 text-center text-slate-400">Nenhuma proposta ainda. <Link href="/app/sites" className="text-brand-300">Abrir meus sites</Link></div>
      ) : (
        <div className="card divide-y divide-white/5">
          {proposals.map((p) => (
            <Link key={p.id} href={`/app/propostas/${p.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-white">{p.title}</p>
                <p className="text-xs text-slate-500">Criada em {p.createdAt.toLocaleDateString("pt-BR")}{p.company ? ` · ${p.company.name}` : ""}</p>
              </div>
              <span className="text-sm font-semibold text-brand-300">{formatBRL(p.priceCents)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
