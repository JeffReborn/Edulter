import type { DbClient } from "@/lib/db";

export interface RetrievalServiceDeps {
  db: DbClient;
}

export interface RetrievalQuery {
  documentIds?: string[];
  question: string;
  limit?: number;
}

/** 检索返回的 chunk 结构（显式类型，避免依赖生成类型的歧义） */
export interface RetrievedChunkData {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  createdAt: Date;
}

export interface RetrievedChunk {
  chunk: RetrievedChunkData;
  score?: number;
  /** 用于 citation 的文档标题 */
  documentTitle: string;
}

const DEFAULT_TOP_K = 10;

/**
 * 从问题中提取用于简单匹配的词（长度 >= 2，去重，小写）。
 */
function tokenizeForMatch(text: string): string[] {
  const tokens = text
    .replace(/[\s\p{P}]/gu, " ")
    .split(/\s+/)
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length >= 2);
  return [...new Set(tokens)];
}

export function createRetrievalService(deps: RetrievalServiceDeps) {
  const { db } = deps;

  return {
    /**
     * 简单基于文本的检索：仅从 status=ready 的文档的 chunk 中，
     * 按“问题中的词在 content 中出现次数”排序，返回 top-k。
     * 不做向量/embedding，不做 rerank。
     */
    async retrieveRelevantChunks(
      query: RetrievalQuery
    ): Promise<RetrievedChunk[]> {
      const limit = Math.min(Math.max(query.limit ?? DEFAULT_TOP_K, 1), 50);
      const questionTokens = tokenizeForMatch(query.question);
      if (questionTokens.length === 0) {
        return [];
      }

      const whereDoc: {
        status: "ready";
        deletedAt: null;
        id?: { in: string[] };
      } = {
        status: "ready",
        deletedAt: null,
      };
      if (query.documentIds?.length) {
        whereDoc.id = { in: query.documentIds };
      }

      const docIds = await db.knowledgeDocument
        .findMany({
          where: whereDoc,
          select: { id: true },
        })
        .then((rows) => rows.map((r) => r.id));

      if (docIds.length === 0) {
        return [];
      }

      const chunksWithDoc = await db.documentChunk.findMany({
        where: { documentId: { in: docIds } },
        include: {
          document: { select: { id: true, title: true } },
        },
        orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
      });

      const scored: Array<{
        chunk: (typeof chunksWithDoc)[0];
        score: number;
      }> = [];

      for (const row of chunksWithDoc) {
        const contentLower = row.content.toLowerCase();
        let score = 0;
        for (const token of questionTokens) {
          if (contentLower.includes(token)) {
            score += 1;
          }
        }
        scored.push({ chunk: row, score });
      }

      scored.sort((a, b) => b.score - a.score);
      const top = scored.filter((s) => s.score > 0).slice(0, limit);

      return top.map(({ chunk, score }) => ({
        chunk: {
          id: String(chunk.id),
          documentId: String(chunk.documentId),
          chunkIndex: Number(chunk.chunkIndex),
          content: String(chunk.content),
          tokenCount: chunk.tokenCount ?? null,
          createdAt: chunk.createdAt,
        },
        score,
        documentTitle: chunk.document.title,
      }));
    },
  };
}

