import { z } from "zod";

export const ProposalDefaultsSchema = z.object({
  developmentPriceCents: z.number().int().min(0).max(100_000_000).default(150000),
  maintenanceMonthlyCents: z.number().int().min(0).max(10_000_000).default(9900),
  domainYearlyCents: z.number().int().min(0).max(10_000_000).default(4000),
  hostingMonthlyCents: z.number().int().min(0).max(10_000_000).default(0),
  deliveryDays: z.number().int().min(1).max(365).default(7),
  paymentTerms: z.string().max(1000).default("50% na aprovação da proposta e 50% na entrega do site."),
  validityDays: z.number().int().min(1).max(365).default(15),
  senderName: z.string().max(120).default(""),
  senderContact: z.string().max(200).default(""),
});
export type ProposalDefaults = z.infer<typeof ProposalDefaultsSchema>;

export const ProposalContentSchema = z.object({
  companyName: z.string().max(160),
  summary: z.string().max(3000),
  benefits: z.array(z.string().max(400)).max(15),
  features: z.array(z.string().max(400)).max(20),
  developmentPriceCents: z.number().int().min(0),
  deliveryDays: z.number().int().min(1),
  paymentTerms: z.string().max(1000),
  domainYearlyCents: z.number().int().min(0),
  hostingMonthlyCents: z.number().int().min(0),
  maintenanceMonthlyCents: z.number().int().min(0),
  includeMaintenance: z.boolean(),
  validityDays: z.number().int().min(1),
  extraTerms: z.string().max(2000),
  closing: z.string().max(1500),
  senderName: z.string().max(120),
  senderContact: z.string().max(200),
  siteUrl: z.string().max(300).optional(),
});
export type ProposalContent = z.infer<typeof ProposalContentSchema>;

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto final da proposta (usado para copiar e para o PDF). */
export function proposalToText(p: ProposalContent): string {
  const lines: string[] = [];
  lines.push(`PROPOSTA COMERCIAL — SITE PROFISSIONAL`, `Para: ${p.companyName}`, "");
  lines.push("RESUMO DO PROJETO", p.summary, "");
  if (p.siteUrl) lines.push(`Prévia do site: ${p.siteUrl}`, "");
  lines.push("BENEFÍCIOS", ...p.benefits.map((b) => `• ${b}`), "");
  lines.push("FUNCIONALIDADES INCLUÍDAS", ...p.features.map((f) => `• ${f}`), "");
  lines.push("INVESTIMENTO");
  lines.push(`• Desenvolvimento do site: ${brl(p.developmentPriceCents)}`);
  lines.push(`• Prazo estimado de entrega: ${p.deliveryDays} dia(s) após a aprovação e o envio das informações`);
  lines.push(`• Condições de pagamento: ${p.paymentTerms}`);
  lines.push("");
  lines.push("CUSTOS ADICIONAIS POSSÍVEIS");
  lines.push(`• Registro de domínio próprio (ex.: .com.br): ${p.domainYearlyCents ? `${brl(p.domainYearlyCents)}/ano (valor estimado, pago ao registrador)` : "a combinar"}`);
  lines.push(`• Hospedagem: ${p.hostingMonthlyCents ? `${brl(p.hostingMonthlyCents)}/mês` : "incluída enquanto o serviço de hospedagem estiver ativo"}`);
  if (p.includeMaintenance) lines.push(`• Manutenção mensal opcional (atualizações de conteúdo e suporte): ${brl(p.maintenanceMonthlyCents)}/mês`);
  lines.push("");
  if (p.extraTerms.trim()) lines.push("CONDIÇÕES", p.extraTerms, "");
  lines.push(`Validade desta proposta: ${p.validityDays} dia(s).`, "");
  lines.push(p.closing, "");
  if (p.senderName) lines.push(p.senderName);
  if (p.senderContact) lines.push(p.senderContact);
  return lines.join("\n");
}
