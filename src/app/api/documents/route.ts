import { NextResponse } from "next/server";

import type { KnowledgeDocumentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { createDocumentService } from "@/server/services/documentService";

const STATUSES: KnowledgeDocumentStatus[] = [
  "uploaded",
  "processing",
  "ready",
  "failed",
];

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

function parseStatus(raw: string | null): KnowledgeDocumentStatus | undefined {
  if (!raw || raw === "all") return undefined;
  if (STATUSES.includes(raw as KnowledgeDocumentStatus)) {
    return raw as KnowledgeDocumentStatus;
  }
  return undefined;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
    const statusRaw = url.searchParams.get("status");
    const status = parseStatus(statusRaw);

    if (statusRaw && statusRaw !== "all" && status === undefined) {
      return jsonError(
        "INVALID_QUERY",
        `Invalid status. Use one of: all, ${STATUSES.join(", ")}.`,
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

    const documentService = createDocumentService({ db: prisma });
    const result = await documentService.listKnowledgeDocuments({
      search: q,
      status,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: {
        documents: result.items.map((d) => ({
          id: d.id,
          title: d.title,
          fileName: d.fileName,
          fileType: d.fileType,
          status: d.status,
          processingError: d.processingError,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError("DOCUMENT_LIST_FAILED", message, 500);
  }
}
