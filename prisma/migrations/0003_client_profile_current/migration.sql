-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClientProfile" ADD COLUMN "supersededAt" TIMESTAMP(3);

-- 存量：每个客户仅保留 createdAt 最新的一条为 current，其余记为历史
UPDATE "ClientProfile" AS p
SET "isCurrent" = true
FROM (
  SELECT DISTINCT ON ("clientId") id
  FROM "ClientProfile"
  ORDER BY "clientId", "createdAt" DESC
) AS latest
WHERE p.id = latest.id;

UPDATE "ClientProfile"
SET "supersededAt" = NOW()
WHERE "isCurrent" = false;

-- 每个 clientId 至多一条 isCurrent = true（PostgreSQL 部分唯一索引）
CREATE UNIQUE INDEX "ClientProfile_one_current_per_client" ON "ClientProfile" ("clientId") WHERE "isCurrent" = true;

-- AlterTable
CREATE INDEX "ClientProfile_clientId_isCurrent_idx" ON "ClientProfile"("clientId", "isCurrent");
