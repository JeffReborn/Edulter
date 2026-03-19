import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { aiClient } from "@/lib/ai";
import {
  createProfileService,
  ProfileExtractionError,
  validateExtractedProfileResult,
} from "@/server/services/profileService";

const MAX_CONVERSATION_TEXT_LENGTH = 20000;

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("INVALID_INPUT", "Malformed JSON body.", 400);
    }

    if (!body || typeof body !== "object") {
      return jsonError("INVALID_INPUT", "Missing request body.", 400);
    }

    const conversationTextRaw = (body as { conversationText?: unknown })
      .conversationText;
    if (typeof conversationTextRaw !== "string") {
      return jsonError(
        "INVALID_INPUT",
        "Field `conversationText` is required and must be a string.",
        400
      );
    }

    const conversationText = conversationTextRaw.trim();
    if (!conversationText) {
      return jsonError(
        "INVALID_INPUT",
        "Field `conversationText` cannot be empty.",
        400
      );
    }
    if (conversationText.length > MAX_CONVERSATION_TEXT_LENGTH) {
      return jsonError(
        "INVALID_INPUT",
        `Field \`conversationText\` must be at most ${MAX_CONVERSATION_TEXT_LENGTH} characters.`,
        400
      );
    }

    const clientDisplayNameRaw = (body as { clientDisplayName?: unknown })
      .clientDisplayName;
    if (
      typeof clientDisplayNameRaw !== "undefined" &&
      typeof clientDisplayNameRaw !== "string"
    ) {
      return jsonError(
        "INVALID_INPUT",
        "Field `clientDisplayName` must be a string when provided.",
        400
      );
    }

    const clientDisplayName = clientDisplayNameRaw?.trim();

    const profileService = createProfileService({ db: prisma, ai: aiClient });
    const result = await profileService.extractProfile({
      conversationText,
      ...(clientDisplayName ? { clientDisplayName } : {}),
    });

    let validated;
    try {
      validated = validateExtractedProfileResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Output schema invalid.";
      return jsonError(
        "PROFILE_SCHEMA_INVALID",
        `Profile output schema invalid: ${msg}`,
        500
      );
    }

    return NextResponse.json({ success: true, data: validated }, { status: 200 });
  } catch (err) {
    if (err instanceof ProfileExtractionError) {
      const status =
        err.code === "INVALID_INPUT"
          ? 400
          : err.code === "PROFILE_SCHEMA_INVALID"
            ? 500
            : 500;
      return jsonError(err.code, err.message, status);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("PROFILE_EXTRACTION_FAILED", message, 500);
  }
}

