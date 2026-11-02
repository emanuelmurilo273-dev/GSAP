-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "hours" TEXT[] DEFAULT ARRAY[]::TEXT[];
