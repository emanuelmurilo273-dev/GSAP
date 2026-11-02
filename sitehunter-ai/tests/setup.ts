process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://sitehunter:sitehunter@localhost:5432/sitehunter_test";
process.env.KIWIFY_WEBHOOK_TOKEN = "kiwify-token-de-teste";
process.env.ROOT_DOMAIN = "sitehunter.test";
process.env.APP_URL = "https://app.sitehunter.test";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.SMTP_HOST;
