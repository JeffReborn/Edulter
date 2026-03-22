-- 重复 displayName 的后备行追加 id 后缀，保证可建唯一约束
WITH numbered AS (
  SELECT
    id,
    "displayName",
    ROW_NUMBER() OVER (PARTITION BY "displayName" ORDER BY "createdAt" ASC) AS rn
  FROM "Client"
)
UPDATE "Client" AS c
SET "displayName" = c."displayName" || '-' || c.id
FROM numbered AS n
WHERE c.id = n.id AND n.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Client_displayName_key" ON "Client"("displayName");
