import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { createClientService } from "@/server/services/clientService";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const clientId = id?.trim();

  if (!clientId) {
    return jsonError("INVALID_INPUT", "client id is required.", 400);
  }

  try {
    const clientService = createClientService({ db: prisma });
    const summary = await clientService.getClientSummary(clientId);
    return NextResponse.json(
      {
        success: true,
        data: summary,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "CLIENT_NOT_FOUND") {
      return jsonError("CLIENT_NOT_FOUND", "当前客户记录不存在或已失效。", 404);
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("CLIENT_DETAIL_FAILED", message, 500);
  }
}
