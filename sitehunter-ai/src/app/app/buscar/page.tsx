import { SearchHero } from "@/components/hunter/SearchHero";
import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { providerStatus } from "@/lib/leads/providers";
import { SEGMENTS } from "@/lib/site/templates";
import { LeadsStudio } from "@/components/leads/LeadsStudio";
import { loadLeadsData } from "@/lib/leads/loadLeads";

export default async function SearchPage() {
  const user = await pageUser();
  const data = await loadLeadsData(user.id);
  return (
    <>
      <PageHeader title="Buscar empresas" subtitle="Qualquer cidade do Brasil. Entram todas as empresas reais encontradas, com ou sem WhatsApp (o telefone já basta); o WhatsApp só é indicado quando a fonte informa. Nenhuma empresa é contatada." />
      <SearchHero />
      <LeadsStudio mode="search" premium={user.access.premium} providers={providerStatus()} nicheSuggestions={SEGMENTS.map((s) => s.query)} {...data} />
    </>
  );
}
