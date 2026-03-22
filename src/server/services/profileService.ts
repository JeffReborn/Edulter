import type { DbClient } from "@/lib/db";
import type { AiClient } from "@/lib/ai";
import { MIN_CLIENT_DISPLAY_NAME_LENGTH } from "@/lib/clientDisplayNameRules";

export interface ProfileServiceDeps {
  db: DbClient;
  ai: AiClient;
}

export interface ExtractProfileInput {
  conversationText: string;
  /** 新建画像时可选；更新画像时不要依赖此字段识别客户 */
  clientDisplayName?: string;
  /** 若提供则走「更新当前客户画像」，以 id 为准 */
  clientId?: string;
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
    | "PERSISTENCE_FAILED"
    | "DISPLAY_NAME_TOO_SHORT"
    | "CLIENT_DISPLAY_NAME_TAKEN"
    | "CLIENT_NOT_FOUND";

  constructor(
    code: ProfileExtractionError["code"],
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.code = code;
  }
}

const TAKEN_DISPLAY_NAME_MESSAGE =
  "该显示名已被使用。若要更新该客户的画像，请从客户列表进入该客户详情页，使用「更新客户画像」。";

function randomPlaceholderSuffix(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return s;
}

function placeholderDateCompact(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** 生成未占用的占位显示名（长度 > MIN） */
async function allocateUniquePlaceholderDisplayName(db: DbClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const name = `未命名-${placeholderDateCompact()}-${randomPlaceholderSuffix()}`;
    const exists = await db.client.findFirst({
      where: { displayName: name },
      select: { id: true },
    });
    if (!exists) return name;
  }
  throw new ProfileExtractionError(
    "PERSISTENCE_FAILED",
    "无法生成唯一的客户显示名，请稍后重试或手动填写显示名。"
  );
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
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

const PROMPT_VERSION = "profile_extract_v2";

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

/**
 * 从首个 `{` 起按括号深度截取完整对象，避免正文前缀或贪婪 `.*` 误匹配导致 parse 失败。
 */
function sliceBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
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
  const fencedJson = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedJson?.[1]) {
    try {
      return JSON.parse(fencedJson[1].trim()) as unknown;
    } catch {
      // ignore
    }
  }

  // 3) ``` ... ```（无语言标记）
  const fenced = text.match(/```\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    try {
      return JSON.parse(inner) as unknown;
    } catch {
      const balanced = sliceBalancedJsonObject(inner);
      if (balanced) {
        try {
          return JSON.parse(balanced) as unknown;
        } catch {
          // ignore
        }
      }
    }
  }

  // 4) 首个平衡 {...}
  const balanced = sliceBalancedJsonObject(text);
  if (balanced) {
    try {
      return JSON.parse(balanced) as unknown;
    } catch {
      // ignore
    }
  }

  return null;
}

type CurrentProfileFields = {
  studentStage: string | null;
  targetCountry: string | null;
  targetProgram: string | null;
  budgetRange: string | null;
  timeline: string | null;
  englishLevel: string | null;
  parentGoals: unknown;
  mainConcerns: unknown;
  riskFlags: unknown;
  currentStage: string;
  structuredJson: unknown;
};

function formatCurrentProfileForPrompt(p: CurrentProfileFields): string {
  const goals = normalizeStringArray(p.parentGoals);
  const concerns = normalizeStringArray(p.mainConcerns);
  const risks = normalizeStringArray(p.riskFlags);
  let structuredPretty = "{}";
  try {
    structuredPretty = JSON.stringify(
      p.structuredJson && typeof p.structuredJson === "object"
        ? p.structuredJson
        : {},
      null,
      2
    );
  } catch {
    structuredPretty = String(p.structuredJson ?? "");
  }
  return [
    `studentStage: ${p.studentStage ?? ""}`,
    `targetCountry: ${p.targetCountry ?? ""}`,
    `targetProgram: ${p.targetProgram ?? ""}`,
    `budgetRange: ${p.budgetRange ?? ""}`,
    `timeline: ${p.timeline ?? ""}`,
    `englishLevel: ${p.englishLevel ?? ""}`,
    `currentStage: ${p.currentStage}`,
    `parentGoals: ${JSON.stringify(goals)}`,
    `mainConcerns: ${JSON.stringify(concerns)}`,
    `riskFlags: ${JSON.stringify(risks)}`,
    "",
    "structuredJson（系统存的全量快照，合并时请整体考虑）:",
    structuredPretty,
  ].join("\n");
}

function buildProfileExtractionPrompt(
  conversationText: string,
  currentProfileBlock: string | null
): string {
  const modeMerge = !!currentProfileBlock;
  return `你是一名「教育咨询顾问助手」。你的任务是：${
    modeMerge
      ? "在「当前系统内有效画像」基础上，结合「本轮新咨询原文」，输出**合并更新后的完整客户画像**（视为新的当前有效画像草案）。"
      : "仅根据「本轮新咨询原文」，提取**首次**结构化客户画像（建立新的当前有效画像）。"
  }

硬性要求：
1) 只能依据下面两节中可核对的信息：${
    modeMerge
      ? "「当前有效画像」与「本轮新咨询」；不要编造、不要猜测。"
      : "「本轮新咨询」；不要编造、不要猜测。"
  }
2) ${
    modeMerge
      ? "旧画像中仍成立、且未被本轮咨询明示推翻或替代的事实应保留；本轮咨询中有更清晰、更新的信息时，以本轮为准。若冲突且无法从文本判断，该字段留空或保守表述，不要胡填。"
      : "信息不足的字段请使用空字符串或空数组；不要用 null。"
  }
3) 必须输出严格 JSON 对象；不要 Markdown；不要多余解释文字。
4) 数组字段必须始终是数组：parentGoals / mainConcerns / riskFlags。
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
- 可附加从上述依据中明确获得、对跟进有价值的键；不得编造

## 当前系统内有效画像
${
  currentProfileBlock ??
  "（无：这是该客户首次在系统内建立画像；请勿引用不存在的旧信息。）"
}

## 本轮新咨询原文（时间上最新；与旧画像冲突时优先采信本节中已明确陈述的内容）
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

type PersistedExtractRow = {
  client: {
    id: string;
    displayName: string;
    currentStage: ClientStage;
    updatedAt: Date;
  };
  conversationRecord: { id: string; createdAt: Date };
  profile: {
    id: string;
    studentStage: string | null;
    targetCountry: string | null;
    targetProgram: string | null;
    budgetRange: string | null;
    timeline: string | null;
    englishLevel: string | null;
    parentGoals: unknown;
    mainConcerns: unknown;
    riskFlags: unknown;
    currentStage: ClientStage;
    structuredJson: unknown;
  };
};

function buildExtractResult(
  persisted: PersistedExtractRow
): ExtractedProfileResult {
  return {
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

      const modelName = process.env.DEEPSEEK_MODEL_TEXT ?? "deepseek-chat";
      const updateClientId = input.clientId?.trim();

      /** 更新画像：仅按 clientId，合并当前画像 + 新咨询 */
      if (updateClientId) {
        const clientRow = await db.client.findUnique({
          where: { id: updateClientId },
        });
        if (!clientRow) {
          throw new ProfileExtractionError(
            "CLIENT_NOT_FOUND",
            "未找到该客户，请从客户列表重新进入。"
          );
        }

        let currentProfileBlock: string | null = null;
        const currentRow = await db.clientProfile.findFirst({
          where: { clientId: clientRow.id, isCurrent: true },
          select: {
            studentStage: true,
            targetCountry: true,
            targetProgram: true,
            budgetRange: true,
            timeline: true,
            englishLevel: true,
            parentGoals: true,
            mainConcerns: true,
            riskFlags: true,
            currentStage: true,
            structuredJson: true,
          },
        });
        if (currentRow) {
          currentProfileBlock = formatCurrentProfileForPrompt(currentRow);
        }

        let rawText: string;
        try {
          const prompt = buildProfileExtractionPrompt(
            input.conversationText,
            currentProfileBlock
          );
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

        try {
          const persisted = await db.$transaction(async (tx) => {
            const client = await tx.client.update({
              where: { id: updateClientId },
              data: {
                studentStage: normalizedProfile.studentStage || undefined,
                targetCountry: normalizedProfile.targetCountry || undefined,
                budgetRange: normalizedProfile.budgetRange || undefined,
                currentStage: normalizedProfile.currentStage,
              },
            });

            const now = new Date();
            await tx.clientProfile.updateMany({
              where: { clientId: client.id, isCurrent: true },
              data: { isCurrent: false, supersededAt: now },
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
                isCurrent: true,
                supersededAt: null,
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

          return validateExtractedProfileResult(buildExtractResult(persisted));
        } catch (err) {
          if (err instanceof ProfileExtractionError) throw err;
          if (isPrismaUniqueViolation(err)) {
            throw new ProfileExtractionError(
              "CLIENT_DISPLAY_NAME_TAKEN",
              TAKEN_DISPLAY_NAME_MESSAGE,
              { cause: err }
            );
          }
          throw new ProfileExtractionError(
            "PERSISTENCE_FAILED",
            `Persistence failed: ${err instanceof Error ? err.message : String(err)}`,
            { cause: err }
          );
        }
      }

      /** 新建画像：显示名可选；有则 ≥3 且全库唯一；无则系统占位名 */
      const rawName = input.clientDisplayName?.trim() ?? "";
      let finalDisplayName: string;
      if (rawName.length > 0) {
        if (rawName.length < MIN_CLIENT_DISPLAY_NAME_LENGTH) {
          throw new ProfileExtractionError(
            "DISPLAY_NAME_TOO_SHORT",
            `显示名至少需要 ${MIN_CLIENT_DISPLAY_NAME_LENGTH} 个字符。`
          );
        }
        const taken = await db.client.findFirst({
          where: { displayName: rawName },
          select: { id: true },
        });
        if (taken) {
          throw new ProfileExtractionError(
            "CLIENT_DISPLAY_NAME_TAKEN",
            TAKEN_DISPLAY_NAME_MESSAGE
          );
        }
        finalDisplayName = rawName;
      } else {
        finalDisplayName = await allocateUniquePlaceholderDisplayName(db);
      }

      let rawText: string;
      try {
        const prompt = buildProfileExtractionPrompt(
          input.conversationText,
          null
        );
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

      try {
        const persisted = await db.$transaction(async (tx) => {
          const client = await tx.client.create({
            data: {
              displayName: finalDisplayName,
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
              isCurrent: true,
              supersededAt: null,
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

        return validateExtractedProfileResult(buildExtractResult(persisted));
      } catch (err) {
        if (err instanceof ProfileExtractionError) throw err;
        if (isPrismaUniqueViolation(err)) {
          throw new ProfileExtractionError(
            "CLIENT_DISPLAY_NAME_TAKEN",
            TAKEN_DISPLAY_NAME_MESSAGE,
            { cause: err }
          );
        }
        throw new ProfileExtractionError(
          "PERSISTENCE_FAILED",
          `Persistence failed: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err }
        );
      }
    },
  };
}

