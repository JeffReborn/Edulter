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

/** 连续汉字串：无英文空格时不能整句当一个词去 substring 匹配。 */
const HAN_RUN = /^\p{Script=Han}+$/u;

/**
 * 单个「词」展开为可匹配单元：拉丁词保持原样；连续汉字拆成 2-gram（含 2 字词本身）。
 */
function expandMatchToken(raw: string): string[] {
  const t = raw.toLowerCase().trim();
  if (t.length < 2) return [];
  if (HAN_RUN.test(t)) {
    if (t.length === 2) return [t];
    const bigrams: string[] = [];
    for (let i = 0; i < t.length - 1; i++) {
      bigrams.push(t.slice(i, i + 2));
    }
    return [...new Set(bigrams)];
  }
  return [t];
}

/**
 * 从问题中提取用于简单匹配的词（拉丁：长度 >= 2；中文：按汉字 2-gram，去重，小写）。
 */
export function tokenizeForMatch(text: string): string[] {
  const parts = text
    .replace(/[\s\p{P}]/gu, " ")
    .split(/\s+/)
    .flatMap((segment) => expandMatchToken(segment));
  return [...new Set(parts)];
}

/**
 * 展示「出处」所需的最低检索分：与问题词元数量挂钩，避免仅靠「孩子/需要」等泛词命中就展示依据。
 * 分值为「问题中有多少个字面单元在该 chunk 中出现」的计数（见 retrieveRelevantChunks）。
 */
export function minMatchScoreForCitations(questionTokenCount: number): number {
  if (questionTokenCount <= 0) return 999;
  if (questionTokenCount <= 2) return 1;
  const raw = Math.ceil(questionTokenCount * 0.35);
  return Math.min(Math.max(raw, 2), 10);
}

export function createRetrievalService(deps: RetrievalServiceDeps) {
  const { db } = deps;

  return {
    /**
     * 简单基于文本的检索：仅从 status=ready 的文档的 chunk 中，
     * 按“问题中的词 / 中文 2-gram 在 content 中出现次数”排序，返回 top-k。
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

