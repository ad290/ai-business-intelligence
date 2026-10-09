-- CreateEnum
CREATE TYPE "DocumentFileType" AS ENUM ('PDF', 'DOCX', 'TXT');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "fileType" "DocumentFileType",
ADD COLUMN     "processingStatus" "DatasetProcessingStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "chunkCount" INTEGER,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processingError" TEXT;
