import type { ClientSelect } from "@/generated/prisma/models/Client";
import type { ClientProfileSelect } from "@/generated/prisma/models/ClientProfile";
import type { ConversationRecordSelect } from "@/generated/prisma/models/ConversationRecord";
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

export interface ExtractedProfileResult {
  client: ClientSelect;
  conversationRecord: ConversationRecordSelect;
  profile: ClientProfileSelect;
}

export function createProfileService(_deps: ProfileServiceDeps) {
  return {
    /**
     * 占位实现：后续任务卡会在这里实现客户画像提取与落库逻辑。
     */
    async extractProfile(
      _input: ExtractProfileInput
    ): Promise<ExtractedProfileResult> {
      throw new Error(
        "profileService.extractProfile is not implemented yet. Implement it in the profile module task cards."
      );
    },
  };
}

