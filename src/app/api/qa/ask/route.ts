import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { aiClient } from "@/lib/ai";
import { createQaService } from "@/server/services/qaService";

/** Demo 阶段问题长度上限，便于后续统一调整。 */
const MAX_QUESTION_LENGTH = 1000;

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

    const questionRaw = (body as { question?: unknown }).question;
    if (typeof questionRaw !== "string") {
      return jsonError(
        "INVALID_INPUT",
        "Field `question` is required and must be a string.",
        400
      );
    }

    const question = questionRaw.trim();
    if (!question) {
      return jsonError("INVALID_INPUT", "Field `question` cannot be empty.", 400);
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      return jsonError(
        "INVALID_INPUT",
        `Field \`question\` must be at most ${MAX_QUESTION_LENGTH} characters.`,
        400
      );
    }

    const qaService = createQaService({ db: prisma, ai: aiClient });
    const result = await qaService.ask({ question });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("LLM_GENERATION_FAILED", message, 500);
  }
}

