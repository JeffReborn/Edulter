import type { DbClient } from "@/lib/db";
import { MIN_CLIENT_DISPLAY_NAME_LENGTH } from "@/lib/clientDisplayNameRules";

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

export class ClientDisplayNameUpdateError extends Error {
  readonly code:
    | "CLIENT_NOT_FOUND"
    | "DISPLAY_NAME_TOO_SHORT"
    | "DISPLAY_NAME_TAKEN"
    | "DISPLAY_NAME_EMPTY";

  constructor(
    code: ClientDisplayNameUpdateError["code"],
    message: string
  ) {
    super(message);
    this.code = code;
    this.name = "ClientDisplayNameUpdateError";
  }
}

export interface ClientServiceDeps {
  db: DbClient;
}

export type ClientStage =
  | "new_lead"
  | "initial_consultation"
  | "in_followup"
  | "high_intent"
  | "uncertain"
  | "closed";

export interface ClientListItem {
  id: string;
  displayName: string;
  studentStage: string | null;
  targetCountry: string | null;
  currentStage: ClientStage;
  updatedAt: string;
  hasProfile: boolean;
  hasFollowup: boolean;
}

export interface ClientSummary {
  client: {
    id: string;
    displayName: string;
    studentStage: string | null;
    targetCountry: string | null;
    budgetRange: string | null;
    currentStage: ClientStage;
    createdAt: string;
    updatedAt: string;
  };
  latestConversationRecord: {
    id: string;
    rawText: string;
    createdAt: string;
  } | null;
  latestProfile: {
    id: string;
    studentStage: string | null;
    targetCountry: string | null;
    targetProgram: string | null;
    budgetRange: string | null;
    timeline: string | null;
    englishLevel: string | null;
    parentGoals: string[];
    mainConcerns: string[];
    riskFlags: string[];
    currentStage: ClientStage;
    structuredJson: Record<string, unknown>;
    createdAt: string;
  } | null;
  latestFollowups: Array<{
    id: string;
    styleType: "wechat_short" | "semi_formal" | "english_optional";
    content: string;
    createdAt: string;
  }>;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function toRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

export function createClientService(_deps: ClientServiceDeps) {
  const { db } = _deps;

  return {
    async listClients(): Promise<ClientListItem[]> {
      const rows = await db.client.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          displayName: true,
          studentStage: true,
          targetCountry: true,
          currentStage: true,
          updatedAt: true,
          profiles: {
            where: { isCurrent: true },
            take: 1,
            select: { id: true },
          },
          _count: {
            select: {
              generatedFollowups: true,
            },
          },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        studentStage: row.studentStage,
        targetCountry: row.targetCountry,
        currentStage: row.currentStage as ClientStage,
        updatedAt: row.updatedAt.toISOString(),
        hasProfile: row.profiles.length > 0,
        hasFollowup: row._count.generatedFollowups > 0,
      }));
    },

    async getClientSummary(clientId: string): Promise<ClientSummary> {
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          displayName: true,
          studentStage: true,
          targetCountry: true,
          budgetRange: true,
          currentStage: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!client) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      const [latestConversationRecord, latestProfile] = await Promise.all([
        db.conversationRecord.findFirst({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rawText: true,
            createdAt: true,
          },
        }),
        db.clientProfile.findFirst({
          where: { clientId, isCurrent: true },
          select: {
            id: true,
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
            createdAt: true,
          },
        }),
      ]);

      const latestFollowups = await db.generatedFollowup.findMany({
        where: {
          clientId,
          ...(latestProfile?.id ? { profileId: latestProfile.id } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          styleType: true,
          content: true,
          createdAt: true,
        },
      });

      return {
        client: {
          id: client.id,
          displayName: client.displayName,
          studentStage: client.studentStage,
          targetCountry: client.targetCountry,
          budgetRange: client.budgetRange,
          currentStage: client.currentStage as ClientStage,
          createdAt: client.createdAt.toISOString(),
          updatedAt: client.updatedAt.toISOString(),
        },
        latestConversationRecord: latestConversationRecord
          ? {
              id: latestConversationRecord.id,
              rawText: latestConversationRecord.rawText,
              createdAt: latestConversationRecord.createdAt.toISOString(),
            }
          : null,
        latestProfile: latestProfile
          ? {
              id: latestProfile.id,
              studentStage: latestProfile.studentStage,
              targetCountry: latestProfile.targetCountry,
              targetProgram: latestProfile.targetProgram,
              budgetRange: latestProfile.budgetRange,
              timeline: latestProfile.timeline,
              englishLevel: latestProfile.englishLevel,
              parentGoals: toStringArray(latestProfile.parentGoals),
              mainConcerns: toStringArray(latestProfile.mainConcerns),
              riskFlags: toStringArray(latestProfile.riskFlags),
              currentStage: latestProfile.currentStage as ClientStage,
              structuredJson: toRecord(latestProfile.structuredJson),
              createdAt: latestProfile.createdAt.toISOString(),
            }
          : null,
        latestFollowups: latestFollowups.map((item) => ({
          id: item.id,
          styleType: item.styleType,
          content: item.content,
          createdAt: item.createdAt.toISOString(),
        })),
      };
    },

    async updateClientDisplayName(
      clientId: string,
      displayName: string
    ): Promise<{ id: string; displayName: string; updatedAt: string }> {
      const trimmed = displayName.trim();
      if (!trimmed) {
        throw new ClientDisplayNameUpdateError(
          "DISPLAY_NAME_EMPTY",
          "显示名不能为空。"
        );
      }
      if (trimmed.length < MIN_CLIENT_DISPLAY_NAME_LENGTH) {
        throw new ClientDisplayNameUpdateError(
          "DISPLAY_NAME_TOO_SHORT",
          `显示名至少需要 ${MIN_CLIENT_DISPLAY_NAME_LENGTH} 个字符。`
        );
      }

      const self = await db.client.findUnique({
        where: { id: clientId },
        select: { id: true, displayName: true },
      });
      if (!self) {
        throw new ClientDisplayNameUpdateError(
          "CLIENT_NOT_FOUND",
          "客户不存在或已删除。"
        );
      }
      if (self.displayName === trimmed) {
        const row = await db.client.findUniqueOrThrow({
          where: { id: clientId },
          select: { id: true, displayName: true, updatedAt: true },
        });
        return {
          id: row.id,
          displayName: row.displayName,
          updatedAt: row.updatedAt.toISOString(),
        };
      }

      const taken = await db.client.findFirst({
        where: { displayName: trimmed, NOT: { id: clientId } },
        select: { id: true },
      });
      if (taken) {
        throw new ClientDisplayNameUpdateError(
          "DISPLAY_NAME_TAKEN",
          "该显示名已被其他客户使用，请重新输入。"
        );
      }

      try {
        const row = await db.client.update({
          where: { id: clientId },
          data: { displayName: trimmed },
          select: { id: true, displayName: true, updatedAt: true },
        });
        return {
          id: row.id,
          displayName: row.displayName,
          updatedAt: row.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isPrismaUniqueViolation(err)) {
          throw new ClientDisplayNameUpdateError(
            "DISPLAY_NAME_TAKEN",
            "该显示名已被其他客户使用，请重新输入。"
          );
        }
        throw err;
      }
    },
  };
}

