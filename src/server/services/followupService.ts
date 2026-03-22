import type { DbClient } from "@/lib/db";
import type { AiClient } from "@/lib/ai";

export interface FollowupServiceDeps {
  db: DbClient;
  ai: AiClient;
}

export interface GenerateFollowupInput {
  clientId: string;
  styleTypes: FollowupStyleType[];
}

export type FollowupStyleType = "wechat_short" | "semi_formal" | "english_optional";

export interface GeneratedFollowupItem {
  id: string;
  styleType: FollowupStyleType;
  content: string;
}

export interface GeneratedFollowupResult {
  clientId: string;
  followups: GeneratedFollowupItem[];
}

export class FollowupGenerationError extends Error {
  code:
    | "INVALID_INPUT"
    | "CLIENT_NOT_FOUND"
    | "PROFILE_NOT_FOUND"
    | "CONVERSATION_NOT_FOUND"
    | "INSUFFICIENT_CONTEXT"
    | "FOLLOWUP_GENERATION_FAILED"
    | "FOLLOWUP_SCHEMA_INVALID"
    | "PERSISTENCE_FAILED";

  constructor(
    code: FollowupGenerationError["code"],
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.code = code;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function assertStringField(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string") {
    throw new Error(`Field \`${key}\` must be a string.`);
  }
  return v;
}

function assertStyleType(v: unknown): FollowupStyleType {
  const allowed: FollowupStyleType[] = [
    "wechat_short",
    "semi_formal",
    "english_optional",
  ];
  if (typeof v !== "string" || !allowed.includes(v as FollowupStyleType)) {
    throw new Error(
      "Field `styleType` must be one of: wechat_short | semi_formal | english_optional."
    );
  }
  return v as FollowupStyleType;
}

export function validateGeneratedFollowupResult(
  result: unknown
): GeneratedFollowupResult {
  if (!isRecord(result)) throw new Error("Result must be an object.");

  const clientId = assertStringField(result, "clientId").trim();
  if (!clientId) throw new Error("Field `clientId` cannot be empty.");

  const followupsRaw = result.followups;
  if (!Array.isArray(followupsRaw)) {
    throw new Error("Field `followups` must be an array.");
  }

  const followups: GeneratedFollowupItem[] = followupsRaw.map((item, idx) => {
    if (!isRecord(item)) {
      throw new Error(`followups[${idx}] must be an object.`);
    }
    const id = assertStringField(item, "id").trim();
    if (!id) throw new Error(`followups[${idx}].id cannot be empty.`);
    const styleType = assertStyleType(item.styleType);
    const content = assertStringField(item, "content").trim();
    if (!content) throw new Error(`followups[${idx}].content cannot be empty.`);
    return { id, styleType, content };
  });

  return { clientId, followups };
}

const PROMPT_VERSION = "followup_generate_v1";

function normalizeText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function styleLabel(styleType: FollowupStyleType): string {
  if (styleType === "wechat_short") return "微信简短版";
  if (styleType === "semi_formal") return "稍正式版";
  return "可选英文版（中文为主，可附一行英文）";
}

function buildFollowupPrompt(input: {
  styleType: FollowupStyleType;
  client: { id: string; displayName: string; studentStage?: string | null; targetCountry?: string | null; budgetRange?: string | null; currentStage: string };
  profile: {
    studentStage?: string | null;
    targetCountry?: string | null;
    targetProgram?: string | null;
    budgetRange?: string | null;
    timeline?: string | null;
    englishLevel?: string | null;
    parentGoals?: unknown;
    mainConcerns?: unknown;
    riskFlags?: unknown;
    currentStage: string;
    structuredJson?: unknown;
  };
  conversationText: string;
}): string {
  const clientName = input.client.displayName?.trim() || "客户";

  // Demo-stage: keep prompt conservative, business-oriented, and structure-light (plain text output).
  return `你是一名“教育咨询顾问助手”。你的任务是：基于下方提供的客户信息、客户画像与最近咨询文本，为顾问生成一条可直接复制发送给客户的“跟进消息草稿”。

硬性要求：
1) 只能依据提供的资料，不要编造、不要猜测、不要虚构承诺（如保证录取、保证时间等）。
2) 对于未明确的信息，用“待确认/可再确认”等保守说法，不要补全具体细节。
3) 只输出消息正文（纯文本），不要输出标题、不要输出“以下是/我为你生成了”等解释句、不要输出 Markdown。
4) 语气要自然、克制、专业，避免强推销与空泛安抚。
5) 字数与风格必须符合：${styleLabel(input.styleType)}。

风格要求（${input.styleType}）：
- wechat_short：更短、更口语化，适合微信直接发；可以 2-5 句，必要时用 1-3 个要点。
- semi_formal：更完整、更有条理；可以分段/要点，但不要太长（建议 120~220 字左右）。
- english_optional：中文为主（不超过 140 字），末尾可附 1 句简短英文（可选）。

客户称呼约定：
- 默认称呼用“您”，称呼对象以“${clientName}”为主（不要编造家长/学生具体称谓）。

## 客户主体摘要（可能不完整）
- clientId: ${input.client.id}
- displayName: ${input.client.displayName}
- studentStage: ${input.client.studentStage ?? ""}
- targetCountry: ${input.client.targetCountry ?? ""}
- budgetRange: ${input.client.budgetRange ?? ""}
- currentStage: ${input.client.currentStage}

## 客户画像（来自系统提取，可能不完整）
- studentStage: ${input.profile.studentStage ?? ""}
- targetCountry: ${input.profile.targetCountry ?? ""}
- targetProgram: ${input.profile.targetProgram ?? ""}
- budgetRange: ${input.profile.budgetRange ?? ""}
- timeline: ${input.profile.timeline ?? ""}
- englishLevel: ${input.profile.englishLevel ?? ""}
- parentGoals: ${JSON.stringify(input.profile.parentGoals ?? [])}
- mainConcerns: ${JSON.stringify(input.profile.mainConcerns ?? [])}
- riskFlags: ${JSON.stringify(input.profile.riskFlags ?? [])}
- currentStage: ${input.profile.currentStage}

## 最近咨询文本（原文）
${input.conversationText}
`;
}

export function createFollowupService(deps: FollowupServiceDeps) {
  const { db, ai } = deps;
  return {
    /**
     * Task 14：真实跟进消息生成 + 持久化
     */
    async generateFollowups(
      input: GenerateFollowupInput
    ): Promise<GeneratedFollowupResult> {
      if (typeof input.clientId !== "string" || !input.clientId.trim()) {
        throw new FollowupGenerationError(
          "INVALID_INPUT",
          "clientId is required."
        );
      }
      const clientId = input.clientId.trim();

      if (!Array.isArray(input.styleTypes) || input.styleTypes.length === 0) {
        throw new FollowupGenerationError(
          "INVALID_INPUT",
          "styleTypes is required."
        );
      }

      const client = await db.client.findUnique({ where: { id: clientId } });
      if (!client) {
        throw new FollowupGenerationError("CLIENT_NOT_FOUND", "Client not found.");
      }

      const currentProfile = await db.clientProfile.findFirst({
        where: { clientId, isCurrent: true },
      });
      if (!currentProfile) {
        throw new FollowupGenerationError(
          "PROFILE_NOT_FOUND",
          "No current client profile found. Please extract profile first."
        );
      }

      const conversationRecordId =
        currentProfile.conversationRecordId ||
        (
          await db.conversationRecord.findFirst({
            where: { clientId },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          })
        )?.id;

      if (!conversationRecordId) {
        throw new FollowupGenerationError(
          "CONVERSATION_NOT_FOUND",
          "No usable conversation record found. Please add consultation text first."
        );
      }

      const conversation = await db.conversationRecord.findUnique({
        where: { id: conversationRecordId },
      });

      const conversationText = normalizeText(conversation?.rawText);
      if (!conversationText) {
        throw new FollowupGenerationError(
          "INSUFFICIENT_CONTEXT",
          "Conversation text is empty. Please add consultation text first."
        );
      }

      const modelName = process.env.DEEPSEEK_MODEL_TEXT ?? "deepseek-chat";

      const promptBase = {
        client: {
          id: client.id,
          displayName: client.displayName,
          studentStage: client.studentStage,
          targetCountry: client.targetCountry,
          budgetRange: client.budgetRange,
          currentStage: client.currentStage,
        },
                profile: {
                  studentStage: currentProfile.studentStage,
                  targetCountry: currentProfile.targetCountry,
                  targetProgram: currentProfile.targetProgram,
                  budgetRange: currentProfile.budgetRange,
                  timeline: currentProfile.timeline,
                  englishLevel: currentProfile.englishLevel,
                  parentGoals: currentProfile.parentGoals,
                  mainConcerns: currentProfile.mainConcerns,
                  riskFlags: currentProfile.riskFlags,
                  currentStage: currentProfile.currentStage,
                  structuredJson: currentProfile.structuredJson,
                },
        conversationText,
      };

      // 网络 LLM 调用不得放在 interactive $transaction 内：默认 5s 超时，多风格连调易超时。
      const drafts: Array<{ styleType: FollowupStyleType; content: string }> = [];
      for (const styleType of input.styleTypes) {
        let content: string;
        try {
          const prompt = buildFollowupPrompt({
            styleType,
            ...promptBase,
          });
          const r = await ai.generate({ model: "followup", prompt });
          content = normalizeText(r.rawText);
        } catch (err) {
          throw new FollowupGenerationError(
            "FOLLOWUP_GENERATION_FAILED",
            `AI followup generation failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
            { cause: err }
          );
        }
        if (!content) {
          throw new FollowupGenerationError(
            "FOLLOWUP_SCHEMA_INVALID",
            "AI output is empty."
          );
        }
        drafts.push({ styleType, content });
      }

      try {
        const persisted = await db.$transaction(async (tx) => {
          const created: GeneratedFollowupItem[] = [];
          for (const { styleType, content } of drafts) {
            const row = await tx.generatedFollowup.create({
              data: {
                clientId: client.id,
                profileId: currentProfile.id,
                conversationRecordId,
                styleType,
                content,
                modelName,
                promptVersion: PROMPT_VERSION,
              },
            });
            created.push({
              id: row.id,
              styleType,
              content: row.content,
            });
          }
          return created;
        });

        return validateGeneratedFollowupResult({
          clientId,
          followups: persisted,
        });
      } catch (err) {
        if (err instanceof FollowupGenerationError) throw err;
        throw new FollowupGenerationError(
          "PERSISTENCE_FAILED",
          `Persistence failed: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err }
        );
      }
    },
  };
}

