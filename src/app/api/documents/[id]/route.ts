import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { createDocumentService } from "@/server/services/documentService";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return jsonError("INVALID_ID", "Missing document id.", 400);
    }

    const documentService = createDocumentService({ db: prisma });
    const result = await documentService.softDeleteKnowledgeDocument(id.trim());

    if (!result.ok) {
      return jsonError("NOT_FOUND", "Document not found or already deleted.", 404);
    }

    return NextResponse.json({ success: true, data: { id: id.trim() } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("DOCUMENT_DELETE_FAILED", message, 500);
  }
}
