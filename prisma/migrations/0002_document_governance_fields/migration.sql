-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN "processingError" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "KnowledgeDocument_deletedAt_idx" ON "KnowledgeDocument"("deletedAt");
