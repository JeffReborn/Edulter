import type { QaLogSelect } from "@/generated/prisma/models/QaLog";
import type { DbClient } from "@/lib/db";
import type { AiClient } from "@/lib/ai";
import {
  createRetrievalService,
  minMatchScoreForCitations,
  tokenizeForMatch,
} from "@/server/services/retrievalService";
import { generateText } from "@/lib/ai";

export interface QaServiceDeps {
  db: DbClient;
  ai: AiClient;
}

export interface AskQuestionInput {
  question: string;
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

/** 无相关上下文时的保守回答文案 */
const NO_CONTEXT_ANSWER =
  "当前知识库中未找到与您问题直接相关的资料依据，无法基于内部资料给出标准答案。建议换一种问法，或补充上传相关文档后再试。";

/**
 * 模型按 Prompt 给出「无法依据资料确定」类回答时，不再附带检索出处，避免与回答语义矛盾。
 */
function isConservativeUnableToAnswer(answer: string): boolean {
  const t = answer.trim();
  if (!t) return true;
  const needles = [
    "根据现有资料无法确定",
    "根据现有资料，无法确定",
    "根据现有资料无法",
    "无法根据现有资料",
    "参考资料不足以",
    "资料不足以回答",
    "不足以回答该问题",
    "不足以回答此问题",
    "未找到与您问题直接相关",
    "无法基于内部资料",
    "当前知识库中未找到",
    "无法给出明确答案",
    "无法给出标准答案",
    "没有足够资料",
  ];
  return needles.some((n) => t.includes(n));
}

/** 构建问答 Prompt：仅依据上下文、不编造、依据不足时保守回答。 */
function buildQaPrompt(question: string, contextBlocks: string[]): string {
  const contextSection =
    contextBlocks.length > 0
      ? contextBlocks.join("\n\n---\n\n")
      : "（未提供任何参考资料。）";

  return `你是一名教育咨询顾问助手。请仅根据下面提供的「参考资料」回答用户问题。要求：
1. 只依据参考资料内容回答，不要编造或补充资料中没有的信息。
2. 回答简洁、清晰、便于顾问直接理解或转述给客户。
3. 若参考资料不足以回答该问题，请明确说明“根据现有资料无法确定”或类似保守表述，不要猜测。

## 参考资料
${contextSection}

## 用户问题
${question}

请直接给出回答正文，不要输出“根据资料……”等前缀，不要输出引用标记。`;
}

/** 从 chunk 内容截取可读 snippet，最大长度 */
function toSnippet(content: string, maxLen: number = 300): string {
  const t = content.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "…";
}

/** 根据「可引用」片段数量与得分决定 confidence（与出处列表一致，避免弱命中仍显示「中」）。 */
function decideConfidence(
  citedCount: number,
  citedScores: number[]
): QaConfidence {
  if (citedCount === 0 || citedScores.length === 0) return "low";
  const maxScore = Math.max(...citedScores);
  if (citedCount >= 3 && maxScore >= 4) return "high";
  if (citedCount >= 1 && maxScore >= 3) return "medium";
  return "low";
}

export function createQaService(deps: QaServiceDeps) {
  const { db } = deps;
  const retrieval = createRetrievalService({ db });

  return {
    async ask(input: AskQuestionInput): Promise<QaAnswer> {
      const { question } = input;

      const retrieved = await retrieval.retrieveRelevantChunks({
        question,
        limit: 10,
      });

      if (retrieved.length === 0) {
        return {
          answer: NO_CONTEXT_ANSWER,
          citations: [],
          confidence: "low",
        };
      }

      const questionTokenCount = tokenizeForMatch(question).length;
      const minCiteScore = minMatchScoreForCitations(questionTokenCount);
      const topScore = Math.max(...retrieved.map((r) => r.score ?? 0), 0);
      const citedChunks =
        topScore >= minCiteScore
          ? retrieved.filter((r) => (r.score ?? 0) >= minCiteScore)
          : [];

      // 与「可展示出处」同一门槛：弱命中不得进入模型上下文，否则易编造或与资料主题不符。
      if (citedChunks.length === 0) {
        return {
          answer: NO_CONTEXT_ANSWER,
          citations: [],
          confidence: "low",
        };
      }

      const contextBlocks = citedChunks.map(
        (r) => `[文档：${r.documentTitle}]\n${r.chunk.content}`
      );
      const prompt = buildQaPrompt(question, contextBlocks);

      let answerText: string;
      try {
        answerText = await generateText(prompt, {
          temperature: 0.2,
          maxTokens: 512,
        });
      } catch (err) {
        throw new Error(
          `问答生成失败：${err instanceof Error ? err.message : String(err)}`
        );
      }

      let citations: QaCitation[] = citedChunks.map((r) => ({
        documentId: r.chunk.documentId,
        documentTitle: r.documentTitle,
        snippet: toSnippet(r.chunk.content),
      }));

      let confidence = decideConfidence(
        citedChunks.length,
        citedChunks.map((r) => r.score ?? 0)
      );

      if (isConservativeUnableToAnswer(answerText)) {
        citations = [];
        confidence = "low";
      }

      const modelName = process.env.DEEPSEEK_MODEL_TEXT ?? "deepseek-chat";

      try {
        const docIds = [...new Set(citations.map((c) => c.documentId))];
        await db.qaLog.create({
          data: {
            question,
            answer: answerText,
            citationsJson: citations as unknown as object,
            modelName,
            ...(docIds.length > 0 && {
              sourceDocuments: { connect: docIds.map((id) => ({ id })) },
            }),
          },
        });
      } catch {
        // 日志写入失败不影响主流程，仅忽略
      }

      return {
        answer: answerText,
        citations,
        confidence,
      };
    },

    async getRecentQaLogs(_limit: number): Promise<
      Array<Pick<QaLogSelect, "id" | "question" | "answer" | "modelName"> & { createdAt: Date }>
    > {
      void _limit;
      throw new Error(
        "qaService.getRecentQaLogs is not implemented yet. Implement it in the QA module task cards."
      );
    },
  };
}

