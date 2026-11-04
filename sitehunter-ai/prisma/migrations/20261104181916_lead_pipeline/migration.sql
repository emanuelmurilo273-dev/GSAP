-- CreateEnum
CREATE TYPE "LeadSearchStatus" AS ENUM ('RUNNING', 'DONE', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "dedupeKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "email" TEXT,
ADD COLUMN     "excludedAt" TIMESTAMP(3),
ADD COLUMN     "facts" JSONB,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'pt-BR',
ADD COLUMN     "opportunities" JSONB,
ADD COLUMN     "opportunityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "presence" JSONB,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "searchId" TEXT,
ADD COLUMN     "socials" JSONB;

-- CreateTable
CREATE TABLE "LeadSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "requested" INTEGER NOT NULL,
    "status" "LeadSearchStatus" NOT NULL DEFAULT 'RUNNING',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "found" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "log" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LeadSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ai" BOOLEAN NOT NULL DEFAULT false,
    "factsUsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadSearch_userId_startedAt_idx" ON "LeadSearch"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "OutreachDraft_userId_companyId_idx" ON "OutreachDraft"("userId", "companyId");

-- CreateIndex
CREATE INDEX "Company_userId_searchId_idx" ON "Company"("userId", "searchId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "LeadSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSearch" ADD CONSTRAINT "LeadSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
