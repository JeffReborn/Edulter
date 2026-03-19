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

export async function GET() {
  try {
    const clientService = createClientService({ db: prisma });
    const clients = await clientService.listClients();

    return NextResponse.json(
      {
        success: true,
        data: { clients },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("CLIENT_LIST_FAILED", message, 500);
  }
}
