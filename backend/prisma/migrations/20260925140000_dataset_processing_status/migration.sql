-- CreateEnum
CREATE TYPE "DatasetProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN "processingStatus" "DatasetProcessingStatus" NOT NULL DEFAULT 'PENDING';
