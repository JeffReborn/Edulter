import { NextResponse } from "next/server";

import { verifyDeepSeekTextConnectivity } from "@/lib/ai";

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

export async function POST() {
  // Foundation-check endpoint: only enable locally to avoid accidental production calls.
  if (process.env.NODE_ENV === "production") {
    return jsonError(
      "NOT_ALLOWED",
      "AI verify endpoint is disabled in production.",
      404
    );
  }

  try {
    const result = await verifyDeepSeekTextConnectivity();
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("DEEPSEEK_VERIFY_FAILED", message, 500);
  }
}

