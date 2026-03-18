import type { KnowledgeDocumentStatus } from "@/generated/prisma/enums";
import type { DbClient } from "@/lib/db";

export interface DocumentServiceDeps {
  db: DbClient;
}

export interface CreateKnowledgeDocumentInput {
  title: string;
  fileName: string;
  fileType: string;
  storageKey: string;
  uploadedById?: string;
}

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  status: KnowledgeDocumentStatus;
  createdAt: Date;
}

export function createDocumentService(deps: DocumentServiceDeps) {
  const { db } = deps;

  return {
    /**
     * 后续任务卡会在这里实现：
     * - 创建文档记录
     * - 更新状态
     * - 读取单个或列表
     */
    async getDocumentById(
      id: string
    ): Promise<KnowledgeDocumentSummary | null> {
      return db.knowledgeDocument.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          fileName: true,
          fileType: true,
          status: true,
          storageKey: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    },

    async listRecentDocuments(
      _limit: number
    ): Promise<KnowledgeDocumentSummary[]> {
      // 仅提供一个简单可扩展的骨架，后续任务卡再补充过滤/分页细节
      const docs = await db.knowledgeDocument.findMany({
        orderBy: { createdAt: "desc" },
        take: _limit,
      });

      return docs.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        createdAt: d.createdAt,
      }));
    },
  };
}

