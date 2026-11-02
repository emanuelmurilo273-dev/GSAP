import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { ProposalDefaultsSchema } from "@/lib/proposal";
import { AccountClient } from "./AccountClient";

export default async function AccountPage() {
  const user = await pageUser();
  return (
    <>
      <PageHeader title="Minha conta" />
      <AccountClient name={user.name} email={user.email} verified={!!user.emailVerifiedAt} isAdmin={user.role === "ADMIN"} defaults={ProposalDefaultsSchema.parse(user.proposalDefaults ?? {})} />
    </>
  );
}
