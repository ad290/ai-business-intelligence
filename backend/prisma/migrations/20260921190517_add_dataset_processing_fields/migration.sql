-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processedRowCount" INTEGER;
