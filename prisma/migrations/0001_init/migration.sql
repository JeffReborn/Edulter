-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'consultant');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('uploaded', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "ClientStage" AS ENUM ('new_lead', 'initial_consultation', 'in_followup', 'high_intent', 'uncertain', 'closed');

-- CreateEnum
CREATE TYPE "ConversationSourceType" AS ENUM ('manual_paste', 'imported');

-- CreateEnum
CREATE TYPE "FollowupStyleType" AS ENUM ('wechat_short', 'semi_formal', 'english_optional');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'consultant',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'uploaded',
    "rawText" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "tokenCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "studentName" TEXT,
    "studentStage" TEXT,
    "targetCountry" TEXT,
    "budgetRange" TEXT,
    "currentStage" "ClientStage" NOT NULL DEFAULT 'uncertain',
    "sourceNote" TEXT,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "sourceType" "ConversationSourceType" NOT NULL DEFAULT 'manual_paste',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "conversationRecordId" TEXT NOT NULL,
    "studentStage" TEXT,
    "targetCountry" TEXT,
    "targetProgram" TEXT,
    "budgetRange" TEXT,
    "timeline" TEXT,
    "englishLevel" TEXT,
    "parentGoals" JSONB,
    "mainConcerns" JSONB,
    "riskFlags" JSONB,
    "currentStage" "ClientStage" NOT NULL DEFAULT 'uncertain',
    "structuredJson" JSONB NOT NULL,
    "modelName" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedFollowup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "profileId" TEXT,
    "conversationRecordId" TEXT,
    "styleType" "FollowupStyleType" NOT NULL,
    "content" TEXT NOT NULL,
    "modelName" TEXT,
    "promptVersion" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaLog" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "citationsJson" JSONB NOT NULL,
    "modelName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QaLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_QaLogSourceDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_QaLogSourceDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_uploadedById_idx" ON "KnowledgeDocument"("uploadedById");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_documentId_chunkIndex_key" ON "DocumentChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "Client_ownerUserId_idx" ON "Client"("ownerUserId");

-- CreateIndex
CREATE INDEX "Client_currentStage_idx" ON "Client"("currentStage");

-- CreateIndex
CREATE INDEX "Client_updatedAt_idx" ON "Client"("updatedAt");

-- CreateIndex
CREATE INDEX "ConversationRecord_clientId_idx" ON "ConversationRecord"("clientId");

-- CreateIndex
CREATE INDEX "ConversationRecord_createdById_idx" ON "ConversationRecord"("createdById");

-- CreateIndex
CREATE INDEX "ConversationRecord_createdAt_idx" ON "ConversationRecord"("createdAt");

-- CreateIndex
CREATE INDEX "ClientProfile_clientId_idx" ON "ClientProfile"("clientId");

-- CreateIndex
CREATE INDEX "ClientProfile_conversationRecordId_idx" ON "ClientProfile"("conversationRecordId");

-- CreateIndex
CREATE INDEX "ClientProfile_createdAt_idx" ON "ClientProfile"("createdAt");

-- CreateIndex
CREATE INDEX "GeneratedFollowup_clientId_idx" ON "GeneratedFollowup"("clientId");

-- CreateIndex
CREATE INDEX "GeneratedFollowup_profileId_idx" ON "GeneratedFollowup"("profileId");

-- CreateIndex
CREATE INDEX "GeneratedFollowup_conversationRecordId_idx" ON "GeneratedFollowup"("conversationRecordId");

-- CreateIndex
CREATE INDEX "GeneratedFollowup_createdById_idx" ON "GeneratedFollowup"("createdById");

-- CreateIndex
CREATE INDEX "GeneratedFollowup_createdAt_idx" ON "GeneratedFollowup"("createdAt");

-- CreateIndex
CREATE INDEX "QaLog_createdById_idx" ON "QaLog"("createdById");

-- CreateIndex
CREATE INDEX "QaLog_createdAt_idx" ON "QaLog"("createdAt");

-- CreateIndex
CREATE INDEX "_QaLogSourceDocuments_B_index" ON "_QaLogSourceDocuments"("B");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRecord" ADD CONSTRAINT "ConversationRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationRecord" ADD CONSTRAINT "ConversationRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_conversationRecordId_fkey" FOREIGN KEY ("conversationRecordId") REFERENCES "ConversationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedFollowup" ADD CONSTRAINT "GeneratedFollowup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedFollowup" ADD CONSTRAINT "GeneratedFollowup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedFollowup" ADD CONSTRAINT "GeneratedFollowup_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ClientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedFollowup" ADD CONSTRAINT "GeneratedFollowup_conversationRecordId_fkey" FOREIGN KEY ("conversationRecordId") REFERENCES "ConversationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaLog" ADD CONSTRAINT "QaLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QaLogSourceDocuments" ADD CONSTRAINT "_QaLogSourceDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QaLogSourceDocuments" ADD CONSTRAINT "_QaLogSourceDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "QaLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
