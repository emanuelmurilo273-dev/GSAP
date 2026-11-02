import { pageUser } from "@/lib/pageAuth";
import { PageHeader, Paywall } from "@/components/app/Shell";
import { SEGMENTS } from "@/lib/site/templates";
import { UFS } from "@/lib/br";
import { SearchClient } from "./SearchClient";
import { env } from "@/lib/env";
import { Alert } from "@/components/ui";

export default async function SearchPage() {
  const user = await pageUser();
  return (
    <>
      <PageHeader title="Buscar empresas" subtitle="Encontre empresas reais por localização e segmento. Dados comerciais públicos fornecidos pelo Google." />
      {!user.access.premium ? (
        <Paywall message={user.access.message} />
      ) : (
        <>
          {!env.googlePlacesKey && <div className="mb-5"><Alert kind="warn">A busca ainda não está configurada: o administrador precisa definir GOOGLE_MAPS_SERVER_KEY no servidor.</Alert></div>}
          <SearchClient segments={SEGMENTS.map((s) => ({ key: s.key, label: s.label }))} ufs={UFS} />
        </>
      )}
    </>
  );
}
