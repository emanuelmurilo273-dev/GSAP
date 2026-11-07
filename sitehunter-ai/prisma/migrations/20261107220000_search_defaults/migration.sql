-- Padrões da busca de empresas no painel administrativo
ALTER TABLE "PlatformSettings" ADD COLUMN "searchDefaultCount" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "PlatformSettings" ADD COLUMN "searchDefaultProvider" TEXT NOT NULL DEFAULT 'osm';
ALTER TABLE "PlatformSettings" ADD COLUMN "searchQuickNiches" TEXT NOT NULL DEFAULT '';
