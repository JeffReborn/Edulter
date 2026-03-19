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

function generatePlaceholderContent(styleType: FollowupStyleType): string {
  if (styleType === "wechat_short") {
    return "老师您好～我把刚才沟通的要点简单整理了一下，方便您确认：\n1) 目标方向/国家：待确认\n2) 时间线：待确认\n3) 预算与关注点：待确认\n您这边方便的话，补充一下最关注的点（如预算/学校/时间）我就能把下一步建议发您。";
  }
  if (styleType === "semi_formal") {
    return "您好，我将本次沟通内容做了初步整理，便于我们后续推进：\n\n- 目前目标与需求：待确认\n- 计划时间线：待确认\n- 预算与关注点：待确认\n\n为了给出更贴合的方案建议，想请您补充确认：目标国家/方向与预计启动时间。确认后我会把下一步材料清单与规划建议发您。";
  }
  return "Hi! Thanks for the conversation. To tailor the next steps, could you please confirm your target country/program and preferred timeline? Once confirmed, I'll share a concise plan and a checklist for what to prepare next.";
}

export function createFollowupService(deps: FollowupServiceDeps) {
  const { db } = deps;
  return {
    /**
     * 占位实现：后续任务卡会在这里实现跟进消息生成与写入逻辑。
     */
    async generateFollowups(
      input: GenerateFollowupInput
    ): Promise<GeneratedFollowupResult> {
      if (typeof input.clientId !== "string" || !input.clientId.trim()) {
        throw new Error("clientId is required.");
      }

      const clientId = input.clientId.trim();
      const exists = await db.client.findUnique({ where: { id: clientId } });
      if (!exists) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      const styleTypes = input.styleTypes;

      const followups: GeneratedFollowupItem[] = styleTypes.map((styleType) => ({
        id: `placeholder_${clientId}_${styleType}`,
        styleType,
        content: generatePlaceholderContent(styleType),
      }));

      return validateGeneratedFollowupResult({ clientId, followups });
    },
  };
}

