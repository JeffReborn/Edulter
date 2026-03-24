import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  createClientService,
  type ClientStage,
} from "@/server/services/clientService";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

const STAGES: ClientStage[] = [
  "new_lead",
  "initial_consultation",
  "in_followup",
  "high_intent",
  "uncertain",
  "closed",
];

function parseStage(raw: string | null): ClientStage | undefined {
  if (!raw || raw === "all") return undefined;
  if (STAGES.includes(raw as ClientStage)) {
    return raw as ClientStage;
  }
  return undefined;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
    const stageRaw = url.searchParams.get("stage");
    const stage = parseStage(stageRaw);

    if (stageRaw && stageRaw !== "all" && stage === undefined) {
      return jsonError(
        "INVALID_QUERY",
        `Invalid stage. Use one of: all, ${STAGES.join(", ")}.`,
        400
      );
    }

    let page = 1;
    const pageRaw = url.searchParams.get("page");
    if (pageRaw) {
      const n = Number(pageRaw);
      if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
        return jsonError("INVALID_QUERY", "Invalid page (must be a positive integer).", 400);
      }
      page = n;
    }

    let pageSize = 15;
    const pageSizeRaw = url.searchParams.get("pageSize");
    if (pageSizeRaw) {
      const n = Number(pageSizeRaw);
      if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
        return jsonError("INVALID_QUERY", "Invalid pageSize.", 400);
      }
      pageSize = Math.min(n, 50);
    }

    const clientService = createClientService({ db: prisma });
    const result = await clientService.listClientsPage({
      page,
      pageSize,
      search: q,
      stage,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          clients: result.clients,
          pagination: {
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages,
          },
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("CLIENT_LIST_FAILED", message, 500);
  }
}
