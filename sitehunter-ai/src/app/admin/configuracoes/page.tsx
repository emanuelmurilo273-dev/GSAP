import { pageUser } from "@/lib/pageAuth";
import { PageHeader } from "@/components/app/Shell";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { env } from "@/lib/env";

export default async function AdminSettings() {
  await pageUser({ admin: true });
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Configurações da plataforma" subtitle="Alterações valem imediatamente para todos os usuários." />
      <SettingsForm initial={{ priceCents: s.priceCents, checkoutUrl: s.checkoutUrl, maxSearchesPerMonth: s.maxSearchesPerMonth, maxGenerationsPerMonth: s.maxGenerationsPerMonth, maxPublishedSites: s.maxPublishedSites, graceDays: s.graceDays, retentionDays: s.retentionDays, usageWarnPercent: s.usageWarnPercent }} envCheckout={env.kiwifyCheckoutUrl ?? null} webhookUrl={`${env.appUrl}/api/webhooks/kiwify`} />
    </>
  );
}
