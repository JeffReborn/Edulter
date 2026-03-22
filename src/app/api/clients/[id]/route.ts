import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  ClientDisplayNameUpdateError,
  createClientService,
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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const clientId = id?.trim();

  if (!clientId) {
    return jsonError("INVALID_INPUT", "client id is required.", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("INVALID_INPUT", "Malformed JSON body.", 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError("INVALID_INPUT", "Missing request body.", 400);
  }

  const displayNameRaw = (body as { displayName?: unknown }).displayName;
  if (typeof displayNameRaw !== "string") {
    return jsonError(
      "INVALID_INPUT",
      "Field `displayName` is required and must be a string.",
      400
    );
  }

  try {
    const clientService = createClientService({ db: prisma });
    const data = await clientService.updateClientDisplayName(
      clientId,
      displayNameRaw
    );
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    if (err instanceof ClientDisplayNameUpdateError) {
      const status =
        err.code === "CLIENT_NOT_FOUND"
          ? 404
          : err.code === "DISPLAY_NAME_TAKEN"
            ? 409
            : 400;
      return jsonError(err.code, err.message, status);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("CLIENT_UPDATE_FAILED", message, 500);
  }
}
