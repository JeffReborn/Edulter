import type { ClientSelect } from "@/generated/prisma/models/Client";
import type { ClientProfileSelect } from "@/generated/prisma/models/ClientProfile";
import type { GeneratedFollowupSelect } from "@/generated/prisma/models/GeneratedFollowup";
import type { DbClient } from "@/lib/db";
import type { AiClient, AiModelName } from "@/lib/ai";

export interface FollowupServiceDeps {
  db: DbClient;
  ai: AiClient;
}

export interface GenerateFollowupInput {
  clientId: string;
  styleTypes: AiModelName[];
}

export interface GeneratedFollowupBundle {
  client: ClientSelect;
  profile: ClientProfileSelect | null;
  followups: GeneratedFollowupSelect[];
}

export function createFollowupService(_deps: FollowupServiceDeps) {
  return {
    /**
     * 占位实现：后续任务卡会在这里实现跟进消息生成与写入逻辑。
     */
    async generateFollowups(
      _input: GenerateFollowupInput
    ): Promise<GeneratedFollowupBundle> {
      throw new Error(
        "followupService.generateFollowups is not implemented yet. Implement it in the follow-up module task cards."
      );
    },
  };
}

