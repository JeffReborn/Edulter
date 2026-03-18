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

export type QaConfidence = "low" | "medium" | "high";

export interface QaCitation {
  documentId: string;
  documentTitle: string;
  snippet: string;
}

export interface QaAnswer {
  answer: string;
  citations: QaCitation[];
  confidence: QaConfidence;
}

export function createQaService(_deps: QaServiceDeps) {
  void _deps; // Task 07 placeholder: dependencies will be used when implementing retrieval/LLM (task 08).
  return {
    /**
     * 任务卡 07 占位实现：
     *  - 只返回稳定输出结构
     *  - 不做检索、Prompt 构造、LLM 生成（待任务卡 08 实现）
     */
    async ask(_input: AskQuestionInput): Promise<QaAnswer> {
      void _input; // Task 07 placeholder: API route layer validates input.
      return {
        answer: "当前问答链路处于骨架阶段，尚未接入检索与回答生成能力。请在任务卡 08 后重试。",
        citations: [],
        confidence: "low",
      };
    },

    /**
     * 预留：后续可在这里查询问答日志。
     */
    async getRecentQaLogs(_limit: number): Promise<
      Array<Pick<QaLogSelect, "id" | "question" | "answer" | "modelName"> & { createdAt: Date }>
    > {
      void _limit; // Reserved for future QA log listing.
      throw new Error(
        "qaService.getRecentQaLogs is not implemented yet. Implement it in the QA module task cards."
      );
    },
  };
}

