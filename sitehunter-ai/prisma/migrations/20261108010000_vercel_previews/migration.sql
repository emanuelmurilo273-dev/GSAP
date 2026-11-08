-- Prévias públicas na Vercel
ALTER TABLE "Publication" ADD COLUMN "externalProvider" TEXT;
ALTER TABLE "Publication" ADD COLUMN "vercelProject" TEXT;
ALTER TABLE "Publication" ADD COLUMN "externalVerifiedAt" TIMESTAMP(3);
