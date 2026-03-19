import type { DbClient } from "@/lib/db";
import type { AiClient } from "@/lib/ai";

export interface ProfileServiceDeps {
  db: DbClient;
  ai: AiClient;
}

export interface ExtractProfileInput {
  conversationText: string;
  clientDisplayName?: string;
}

export type ClientStage =
  | "new_lead"
  | "initial_consultation"
  | "in_followup"
  | "high_intent"
  | "uncertain"
  | "closed";

export interface ExtractedClient {
  id: string;
  displayName: string;
  currentStage: ClientStage;
  updatedAt: string;
}

export interface ExtractedConversationRecord {
  id: string;
  createdAt: string;
}

export interface ExtractedProfile {
  id: string;
  studentStage: string;
  targetCountry: string;
  targetProgram: string;
  budgetRange: string;
  timeline: string;
  englishLevel: string;
  parentGoals: string[];
  mainConcerns: string[];
  riskFlags: string[];
  currentStage: ClientStage;
  structuredJson: Record<string, unknown>;
}

export interface ExtractedProfileResult {
  client: ExtractedClient;
  conversationRecord: ExtractedConversationRecord;
  profile: ExtractedProfile;
}

export class ProfileExtractionError extends Error {
  code:
    | "INVALID_INPUT"
    | "PROFILE_EXTRACTION_FAILED"
    | "PROFILE_SCHEMA_INVALID"
    | "PERSISTENCE_FAILED";

  constructor(
    code: ProfileExtractionError["code"],
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

function assertStringArrayField(
  obj: Record<string, unknown>,
  key: string
): string[] {
  const v = obj[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new Error(`Field \`${key}\` must be an array of strings.`);
  }
  return v as string[];
}

function assertClientStageField(
  obj: Record<string, unknown>,
  key: string
): ClientStage {
  const v = obj[key];
  const allowed: ClientStage[] = [
    "new_lead",
    "initial_consultation",
    "in_followup",
    "high_intent",
    "uncertain",
    "closed",
  ];
  if (typeof v !== "string" || !allowed.includes(v as ClientStage)) {
    throw new Error(`Field \`${key}\` must be a valid client stage.`);
  }
  return v as ClientStage;
}

const PROMPT_VERSION = "profile_extract_v1";

function normalizeString(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeStage(v: unknown): ClientStage {
  const allowed: ClientStage[] = [
    "new_lead",
    "initial_consultation",
    "in_followup",
    "high_intent",
    "uncertain",
    "closed",
  ];
  if (typeof v !== "string") return "uncertain";
  const t = v.trim() as ClientStage;
  return allowed.includes(t) ? t : "uncertain";
}

function extractJsonObjectFromText(rawText: string): unknown {
  const text = rawText.trim();
  if (!text) return null;

  // 1) Direct JSON
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // ignore
  }

  // 2) ```json ... ```
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as unknown;
    } catch {
      // ignore
    }
  }

  // 3) First {...} block
  const firstObj = text.match(/\{[\s\S]*\}/);
  if (firstObj?.[0]) {
    try {
      return JSON.parse(firstObj[0]) as unknown;
    } catch {
      // ignore
    }
  }

  return null;
}

function buildProfileExtractionPrompt(conversationText: string): string {
  return `你是一名“教育咨询顾问助手”，你的任务是：仅根据下面提供的咨询文本，提取结构化客户画像信息。

要求：
1) 只能依据咨询文本内容，不要编造、不要猜测、不要补全不存在的信息。
2) 信息不足的字段请使用空字符串（""）或空数组（[]）。不要用 null。
3) 必须输出“严格 JSON 对象”，不要输出 Markdown、不要输出多余解释文字。
4) 数组字段必须始终是数组：parentGoals/mainConcerns/riskFlags。
5) currentStage 必须是以下枚举之一：new_lead / initial_consultation / in_followup / high_intent / uncertain / closed。若无法判断，请输出 uncertain。

请输出以下结构（字段名必须一致）：
{
  "studentStage": string,
  "targetCountry": string,
  "targetProgram": string,
  "budgetRange": string,
  "timeline": string,
  "englishLevel": string,
  "parentGoals": string[],
  "mainConcerns": string[],
  "riskFlags": string[],
  "currentStage": "new_lead" | "initial_consultation" | "in_followup" | "high_intent" | "uncertain" | "closed",
  "structuredJson": object
}

其中 structuredJson 要求：
- 必须是 JSON 对象
- 至少包含以上所有字段的同名拷贝（便于落库保留完整结构）
- 可以额外包含你认为对后续跟进有价值、且能从文本中明确获得的信息，但不得编造

## 咨询文本
${conversationText}
`;
}

export function validateExtractedProfileResult(
  result: unknown
): ExtractedProfileResult {
  if (!isRecord(result)) throw new Error("Result must be an object.");

  const clientRaw = result.client;
  const conversationRaw = result.conversationRecord;
  const profileRaw = result.profile;

  if (!isRecord(clientRaw)) throw new Error("Field `client` must be an object.");
  if (!isRecord(conversationRaw))
    throw new Error("Field `conversationRecord` must be an object.");
  if (!isRecord(profileRaw))
    throw new Error("Field `profile` must be an object.");

  const client: ExtractedClient = {
    id: assertStringField(clientRaw, "id"),
    displayName: assertStringField(clientRaw, "displayName"),
    currentStage: assertClientStageField(clientRaw, "currentStage"),
    updatedAt: assertStringField(clientRaw, "updatedAt"),
  };

  const conversationRecord: ExtractedConversationRecord = {
    id: assertStringField(conversationRaw, "id"),
    createdAt: assertStringField(conversationRaw, "createdAt"),
  };

  const structuredJsonRaw = profileRaw.structuredJson;
  if (!isRecord(structuredJsonRaw)) {
    throw new Error("Field `profile.structuredJson` must be an object.");
  }

  const profile: ExtractedProfile = {
    id: assertStringField(profileRaw, "id"),
    studentStage: assertStringField(profileRaw, "studentStage"),
    targetCountry: assertStringField(profileRaw, "targetCountry"),
    targetProgram: assertStringField(profileRaw, "targetProgram"),
    budgetRange: assertStringField(profileRaw, "budgetRange"),
    timeline: assertStringField(profileRaw, "timeline"),
    englishLevel: assertStringField(profileRaw, "englishLevel"),
    parentGoals: assertStringArrayField(profileRaw, "parentGoals"),
    mainConcerns: assertStringArrayField(profileRaw, "mainConcerns"),
    riskFlags: assertStringArrayField(profileRaw, "riskFlags"),
    currentStage: assertClientStageField(profileRaw, "currentStage"),
    structuredJson: structuredJsonRaw,
  };

  return { client, conversationRecord, profile };
}

function toIso(d: Date): string {
  return d.toISOString();
}

function ensureNonEmptyConversationText(conversationText: string) {
  if (typeof conversationText !== "string" || !conversationText.trim()) {
    throw new ProfileExtractionError(
      "INVALID_INPUT",
      "conversationText is required."
    );
  }
}

function normalizeProfilePayload(payload: unknown): Omit<ExtractedProfile, "id"> {
  if (!isRecord(payload)) {
    throw new ProfileExtractionError(
      "PROFILE_SCHEMA_INVALID",
      "AI output must be a JSON object."
    );
  }

  const structuredRaw = payload.structuredJson;
  const structuredJson =
    isRecord(structuredRaw) ? structuredRaw : ({} as Record<string, unknown>);

  const studentStage = normalizeString(payload.studentStage);
  const targetCountry = normalizeString(payload.targetCountry);
  const targetProgram = normalizeString(payload.targetProgram);
  const budgetRange = normalizeString(payload.budgetRange);
  const timeline = normalizeString(payload.timeline);
  const englishLevel = normalizeString(payload.englishLevel);
  const parentGoals = normalizeStringArray(payload.parentGoals);
  const mainConcerns = normalizeStringArray(payload.mainConcerns);
  const riskFlags = normalizeStringArray(payload.riskFlags);
  const currentStage = normalizeStage(payload.currentStage);

  // Ensure structuredJson always contains a conservative mirror of top-level fields
  const structuredMerged: Record<string, unknown> = {
    studentStage,
    targetCountry,
    targetProgram,
    budgetRange,
    timeline,
    englishLevel,
    parentGoals,
    mainConcerns,
    riskFlags,
    currentStage,
    ...structuredJson,
  };

  return {
    studentStage,
    targetCountry,
    targetProgram,
    budgetRange,
    timeline,
    englishLevel,
    parentGoals,
    mainConcerns,
    riskFlags,
    currentStage,
    structuredJson: structuredMerged,
  };
}

export function createProfileService(deps: ProfileServiceDeps) {
  const { db, ai } = deps;
  return {
    async extractProfile(
      input: ExtractProfileInput
    ): Promise<ExtractedProfileResult> {
      ensureNonEmptyConversationText(input.conversationText);

      const clientDisplayName = input.clientDisplayName?.trim();
      const resolvedDisplayName = clientDisplayName || "未命名客户";

      // 1) AI extraction (raw JSON in text)
      let rawText: string;
      try {
        const prompt = buildProfileExtractionPrompt(input.conversationText);
        const r = await ai.generate({ model: "profile", prompt });
        rawText = r.rawText;
      } catch (err) {
        throw new ProfileExtractionError(
          "PROFILE_EXTRACTION_FAILED",
          `AI profile extraction failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
          { cause: err }
        );
      }

      const parsed = extractJsonObjectFromText(rawText);
      if (!parsed) {
        throw new ProfileExtractionError(
          "PROFILE_SCHEMA_INVALID",
          "AI output is not valid JSON."
        );
      }

      const normalizedProfile = normalizeProfilePayload(parsed);

      const modelName = process.env.DEEPSEEK_MODEL_TEXT ?? "deepseek-chat";

      // 2) Persistence (client + conversationRecord + clientProfile)
      try {
        const persisted = await db.$transaction(async (tx) => {
          // Demo-stage matching rule: exact match by displayName when provided; otherwise always create new.
          const existingClient =
            clientDisplayName && clientDisplayName.trim()
              ? await tx.client.findFirst({
                  where: { displayName: clientDisplayName.trim() },
                  orderBy: { updatedAt: "desc" },
                })
              : null;

          const client = existingClient
            ? await tx.client.update({
                where: { id: existingClient.id },
                data: {
                  displayName: resolvedDisplayName,
                  studentStage: normalizedProfile.studentStage || undefined,
                  targetCountry: normalizedProfile.targetCountry || undefined,
                  budgetRange: normalizedProfile.budgetRange || undefined,
                  currentStage: normalizedProfile.currentStage,
                },
              })
            : await tx.client.create({
                data: {
                  displayName: resolvedDisplayName,
                  studentStage: normalizedProfile.studentStage || undefined,
                  targetCountry: normalizedProfile.targetCountry || undefined,
                  budgetRange: normalizedProfile.budgetRange || undefined,
                  currentStage: normalizedProfile.currentStage,
                },
              });

          const conversationRecord = await tx.conversationRecord.create({
            data: {
              clientId: client.id,
              rawText: input.conversationText,
              sourceType: "manual_paste",
            },
          });

          const profile = await tx.clientProfile.create({
            data: {
              clientId: client.id,
              conversationRecordId: conversationRecord.id,
              studentStage: normalizedProfile.studentStage || null,
              targetCountry: normalizedProfile.targetCountry || null,
              targetProgram: normalizedProfile.targetProgram || null,
              budgetRange: normalizedProfile.budgetRange || null,
              timeline: normalizedProfile.timeline || null,
              englishLevel: normalizedProfile.englishLevel || null,
              parentGoals: normalizedProfile.parentGoals as unknown as object,
              mainConcerns: normalizedProfile.mainConcerns as unknown as object,
              riskFlags: normalizedProfile.riskFlags as unknown as object,
              currentStage: normalizedProfile.currentStage,
              structuredJson: normalizedProfile.structuredJson as unknown as object,
              modelName,
              promptVersion: PROMPT_VERSION,
            },
          });

          return { client, conversationRecord, profile };
        });

        const result: ExtractedProfileResult = {
          client: {
            id: persisted.client.id,
            displayName: persisted.client.displayName,
            currentStage: persisted.client.currentStage,
            updatedAt: toIso(persisted.client.updatedAt),
          },
          conversationRecord: {
            id: persisted.conversationRecord.id,
            createdAt: toIso(persisted.conversationRecord.createdAt),
          },
          profile: {
            id: persisted.profile.id,
            studentStage: persisted.profile.studentStage ?? "",
            targetCountry: persisted.profile.targetCountry ?? "",
            targetProgram: persisted.profile.targetProgram ?? "",
            budgetRange: persisted.profile.budgetRange ?? "",
            timeline: persisted.profile.timeline ?? "",
            englishLevel: persisted.profile.englishLevel ?? "",
            parentGoals: (persisted.profile.parentGoals as unknown as string[]) ?? [],
            mainConcerns:
              (persisted.profile.mainConcerns as unknown as string[]) ?? [],
            riskFlags: (persisted.profile.riskFlags as unknown as string[]) ?? [],
            currentStage: persisted.profile.currentStage,
            structuredJson:
              persisted.profile.structuredJson as unknown as Record<string, unknown>,
          },
        };

        return validateExtractedProfileResult(result);
      } catch (err) {
        if (err instanceof ProfileExtractionError) throw err;
        throw new ProfileExtractionError(
          "PERSISTENCE_FAILED",
          `Persistence failed: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err }
        );
      }
    },
  };
}

