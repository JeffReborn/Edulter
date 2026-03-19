import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { aiClient } from "@/lib/ai";
import {
  createFollowupService,
  type FollowupStyleType,
  FollowupGenerationError,
  validateGeneratedFollowupResult,
} from "@/server/services/followupService";

const ALLOWED_STYLE_TYPES: FollowupStyleType[] = [
  "wechat_short",
  "semi_formal",
  "english_optional",
];

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

    const clientIdRaw = (body as { clientId?: unknown }).clientId;
    if (typeof clientIdRaw !== "string") {
      return jsonError(
        "INVALID_INPUT",
        "Field `clientId` is required and must be a string.",
        400
      );
    }
    const clientId = clientIdRaw.trim();
    if (!clientId) {
      return jsonError("INVALID_INPUT", "Field `clientId` cannot be empty.", 400);
    }

    const styleTypesRaw = (body as { styleTypes?: unknown }).styleTypes;
    let styleTypes: FollowupStyleType[];
    if (typeof styleTypesRaw === "undefined") {
      // Documented default behavior when styleTypes is missing entirely.
      styleTypes = ["wechat_short", "semi_formal"];
    } else {
      if (!Array.isArray(styleTypesRaw)) {
        return jsonError(
          "INVALID_INPUT",
          "Field `styleTypes` must be an array of strings when provided.",
          400
        );
      }

      const cleaned = styleTypesRaw.map((x) => (typeof x === "string" ? x.trim() : ""));
      const normalized = cleaned.filter(Boolean);
      if (normalized.length === 0) {
        return jsonError(
          "INVALID_INPUT",
          "Field `styleTypes` must contain at least one non-empty string.",
          400
        );
      }

      const unknown = normalized.filter(
        (x) => !ALLOWED_STYLE_TYPES.includes(x as FollowupStyleType)
      );
      if (unknown.length > 0) {
        return jsonError(
          "INVALID_INPUT",
          `Unknown styleTypes: ${unknown.join(", ")}.`,
          400
        );
      }

      styleTypes = Array.from(new Set(normalized)) as FollowupStyleType[];
    }

    const followupService = createFollowupService({ db: prisma, ai: aiClient });
    let result;
    try {
      result = await followupService.generateFollowups({
        clientId,
        styleTypes,
      });
    } catch (e) {
      if (e instanceof FollowupGenerationError) {
        if (e.code === "CLIENT_NOT_FOUND") {
          return jsonError("CLIENT_NOT_FOUND", "Client not found.", 404);
        }
        if (e.code === "PROFILE_NOT_FOUND") {
          return jsonError(
            "PROFILE_NOT_FOUND",
            "No usable client profile found. Please extract profile first.",
            404
          );
        }
        if (e.code === "CONVERSATION_NOT_FOUND" || e.code === "INSUFFICIENT_CONTEXT") {
          return jsonError(
            "INSUFFICIENT_CONTEXT",
            "No usable conversation context found. Please add consultation text first.",
            400
          );
        }
        if (e.code === "INVALID_INPUT") {
          return jsonError("INVALID_INPUT", e.message, 400);
        }
        if (e.code === "FOLLOWUP_SCHEMA_INVALID") {
          return jsonError("FOLLOWUP_SCHEMA_INVALID", e.message, 500);
        }
        return jsonError(
          "FOLLOWUP_GENERATION_FAILED",
          e.message || "Followup generation failed.",
          500
        );
      }

      const msg = e instanceof Error ? e.message : "Unknown error";
      return jsonError("FOLLOWUP_GENERATION_FAILED", msg, 500);
    }

    let validated;
    try {
      validated = validateGeneratedFollowupResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Output schema invalid.";
      return jsonError(
        "FOLLOWUP_SCHEMA_INVALID",
        `Followup output schema invalid: ${msg}`,
        500
      );
    }

    return NextResponse.json({ success: true, data: validated }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("FOLLOWUP_GENERATION_FAILED", message, 500);
  }
}

