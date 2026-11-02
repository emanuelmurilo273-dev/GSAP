-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "research" JSONB,
ADD COLUMN     "researchedAt" TIMESTAMP(3),
ADD COLUMN     "reviews" JSONB;
