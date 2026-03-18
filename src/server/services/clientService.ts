import type { ClientSelect } from "@/generated/prisma/models/Client";
import type { ClientProfileSelect } from "@/generated/prisma/models/ClientProfile";
import type { ConversationRecordSelect } from "@/generated/prisma/models/ConversationRecord";
import type { GeneratedFollowupSelect } from "@/generated/prisma/models/GeneratedFollowup";
import type { DbClient } from "@/lib/db";

export interface ClientServiceDeps {
  db: DbClient;
}

export interface ClientSummary {
  client: ClientSelect;
  latestProfile: ClientProfileSelect | null;
  latestConversation: ConversationRecordSelect | null;
  latestFollowup: GeneratedFollowupSelect | null;
}

export function createClientService(_deps: ClientServiceDeps) {
  return {
    /**
     * 占位实现：后续任务卡会在这里实现客户列表与详情聚合逻辑。
     */
    async listClients(): Promise<ClientSelect[]> {
      throw new Error(
        "clientService.listClients is not implemented yet. Implement it in the client module task cards."
      );
    },

    async getClientSummary(_clientId: string): Promise<ClientSummary> {
      throw new Error(
        "clientService.getClientSummary is not implemented yet. Implement it in the client module task cards."
      );
    },
  };
}

