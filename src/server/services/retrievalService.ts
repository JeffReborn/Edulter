import type { DocumentChunkSelect } from "@/generated/prisma/models/DocumentChunk";
import type { DbClient } from "@/lib/db";

export interface RetrievalServiceDeps {
  db: DbClient;
}

export interface RetrievalQuery {
  documentIds?: string[];
  question: string;
  limit?: number;
}

export interface RetrievedChunk {
  chunk: Pick<
    DocumentChunkSelect,
    "id" | "documentId" | "chunkIndex" | "content" | "tokenCount"
  > & { createdAt: Date };
  score?: number;
}

export function createRetrievalService(_deps: RetrievalServiceDeps) {
  return {
    /**
     * 占位实现：后续任务卡会在这里接入向量检索 / 关键词检索。
     * 目前仅抛错以防被误用。
     */
    async retrieveRelevantChunks(
      _query: RetrievalQuery
    ): Promise<RetrievedChunk[]> {
      throw new Error(
        "retrieveRelevantChunks is not implemented yet. Implement it in the retrieval task card."
      );
    },
  };
}

