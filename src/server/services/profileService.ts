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

export function createProfileService(_deps: ProfileServiceDeps) {
  void _deps;
  return {
    /**
     * 占位实现：后续任务卡会在这里实现客户画像提取与落库逻辑。
     */
    async extractProfile(
      input: ExtractProfileInput
    ): Promise<ExtractedProfileResult> {
      const nowIso = new Date().toISOString();
      const id = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `tmp_${Date.now()}`;

      const displayName =
        input.clientDisplayName?.trim() ||
        "未命名客户";

      const placeholder: ExtractedProfileResult = {
        client: {
          id,
          displayName,
          currentStage: "uncertain",
          updatedAt: nowIso,
        },
        conversationRecord: {
          id,
          createdAt: nowIso,
        },
        profile: {
          id,
          studentStage: "",
          targetCountry: "",
          targetProgram: "",
          budgetRange: "",
          timeline: "",
          englishLevel: "",
          parentGoals: [],
          mainConcerns: [],
          riskFlags: [],
          currentStage: "uncertain",
          structuredJson: {
            placeholder: true,
            conversationTextPreview: input.conversationText.slice(0, 200),
          },
        },
      };

      return validateExtractedProfileResult(placeholder);
    },
  };
}

