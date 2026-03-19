import type { DbClient } from "@/lib/db";

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
  client: ClientListItem;
  latestProfile: unknown | null;
  latestConversation: unknown | null;
  latestFollowup: unknown | null;
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
          _count: {
            select: {
              profiles: true,
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
        hasProfile: row._count.profiles > 0,
        hasFollowup: row._count.generatedFollowups > 0,
      }));
    },

    async getClientSummary(_clientId: string): Promise<ClientSummary> {
      void _clientId;
      throw new Error(
        "clientService.getClientSummary is not implemented yet. Implement it in the client module task cards."
      );
    },
  };
}

