import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { providerStatus } from "@/lib/leads/providers";
import { loadLeadsData } from "@/lib/leads/loadLeads";
import { SEGMENTS } from "@/lib/site/templates";
import { LeadsStudio } from "@/components/leads/LeadsStudio";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const user = await pageUser();
  const data = await loadLeadsData(user.id);
  const { search } = await searchParams;
  return (
    <>
      <PageHeader title="Leads encontrados" subtitle="Empresas com WhatsApp comercial confirmado em fonte pública. Filtre por status, abra o perfil, crie a prévia e prepare a abordagem." />
      <LeadsStudio mode="list" initialSearchId={search ?? ""} premium={user.access.premium} providers={providerStatus()} nicheSuggestions={SEGMENTS.map((s) => s.query)} {...data} />
    </>
  );
}
