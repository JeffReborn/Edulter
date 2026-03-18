import type { QaLogSelect } from "@/generated/prisma/models/QaLog";
import type { DbClient } from "@/lib/db";
import type { AiClient } from "@/lib/ai";

export interface QaServiceDeps {
  db: DbClient;
  ai: AiClient;
}

export interface AskQuestionInput {
  question: string;
  // 后续可补充 clientId / contextIds 等字段
}

export interface QaAnswer {
  answer: string;
  citations: Array<{
    documentId: string;
    chunkId?: string;
  }>;
}

export function createQaService(_deps: QaServiceDeps) {
  return {
    /**
     * 占位实现：后续任务卡会在这里串联检索、AI 调用与日志写入。
     */
    async ask(_input: AskQuestionInput): Promise<QaAnswer> {
      throw new Error(
        "qaService.ask is not implemented yet. Implement it in the QA module task cards."
      );
    },

    /**
     * 预留：后续可在这里查询问答日志。
     */
    async getRecentQaLogs(_limit: number): Promise<
      Array<Pick<QaLogSelect, "id" | "question" | "answer" | "modelName"> & { createdAt: Date }>
    > {
      throw new Error(
        "qaService.getRecentQaLogs is not implemented yet. Implement it in the QA module task cards."
      );
    },
  };
}

