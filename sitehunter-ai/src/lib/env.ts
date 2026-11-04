// Acesso centralizado às variáveis de ambiente (somente servidor).
import "server-only";

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const env = {
  get appUrl() { return (opt("APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""); },
  get rootDomain() { return (opt("ROOT_DOMAIN") ?? "localhost:3000").toLowerCase(); },
  get isProd() { return process.env.NODE_ENV === "production"; },
  get cronSecret() { return opt("CRON_SECRET"); },
  /**
   * "private" (padrão): produto de uso exclusivo do proprietário. Sem cadastro
   * público; só a conta proprietária (ADMIN, e OWNER_EMAIL quando definido)
   * consegue autenticar. "saas": comportamento multiusuário com assinatura.
   */
  get accessMode(): "private" | "saas" { return opt("ACCESS_MODE") === "saas" ? "saas" : "private"; },
  get ownerEmail() { return opt("OWNER_EMAIL")?.toLowerCase(); },
  get adminEmails() {
    return (opt("ADMIN_EMAILS") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  },
  get googlePlacesKey() { return opt("GOOGLE_PLACES_API_KEY"); },
  get anthropicKey() { return opt("ANTHROPIC_API_KEY"); },
  get aiModel() { return opt("AI_MODEL") ?? "claude-opus-5-5"; },
  get unsplashKey() { return opt("UNSPLASH_ACCESS_KEY"); },
  get openverseToken() { return opt("OPENVERSE_TOKEN"); },
  get imageSearchDisabled() { return opt("IMAGE_SEARCH") === "off"; },
  get nominatimUrl() { return opt("NOMINATIM_URL"); },
  get osmContactEmail() { return opt("OSM_CONTACT_EMAIL"); },
  get kiwifyWebhookTokens() {
    return [opt("KIWIFY_WEBHOOK_TOKEN"), opt("KIWIFY_WEBHOOK_TOKEN_PREVIOUS")].filter(Boolean) as string[];
  },
  get kiwifyCheckoutUrl() { return opt("KIWIFY_CHECKOUT_URL"); },
  get kiwifyApi() {
    const clientId = opt("KIWIFY_CLIENT_ID");
    const clientSecret = opt("KIWIFY_CLIENT_SECRET");
    const accountId = opt("KIWIFY_ACCOUNT_ID");
    return clientId && clientSecret && accountId ? { clientId, clientSecret, accountId } : undefined;
  },
  get smtp() {
    const host = opt("SMTP_HOST");
    if (!host) return undefined;
    return {
      host,
      port: Number(opt("SMTP_PORT") ?? 587),
      user: opt("SMTP_USER"),
      pass: opt("SMTP_PASS"),
      from: opt("EMAIL_FROM") ?? "SiteHunter AI <no-reply@localhost>",
    };
  },
  get requireEmailVerification() {
    return opt("REQUIRE_EMAIL_VERIFICATION") === "true";
  },
  get serverIps() {
    return (opt("PUBLIC_SERVER_IPS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  },
};
