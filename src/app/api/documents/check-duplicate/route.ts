import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { createDocumentService } from "@/server/services/documentService";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fileName = url.searchParams.get("fileName")?.trim() ?? "";

  if (!fileName) {
    return NextResponse.json({
      success: true,
      data: { exists: false },
    });
  }

  const documentService = createDocumentService({ db: prisma });
  const document = await documentService.findActiveDocumentByFileName(fileName);

  if (!document) {
    return NextResponse.json({
      success: true,
      data: { exists: false },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      exists: true,
      document: {
        id: document.id,
        title: document.title,
        fileName: document.fileName,
        status: document.status,
      },
    },
  });
}
