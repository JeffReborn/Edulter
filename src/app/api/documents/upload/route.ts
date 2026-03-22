import { NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/db";
import {
  DocumentUploadError,
  createDocumentService,
} from "@/server/services/documentService";

function getErrorStatusCode(code: string) {
  switch (code) {
    case "INVALID_FILE":
    case "UNSUPPORTED_FILE_TYPE":
      return 400;
    case "UPLOAD_FAILED":
    case "PROCESSING_INIT_FAILED":
    case "PROCESSING_FAILED":
      return 500;
    default:
      return 500;
  }
}

function jsonError(code: string, message: string) {
  const status = getErrorStatusCode(code);
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

type UploadFileLike = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const uploaded = formData.get("file");

    if (!uploaded) {
      return jsonError("INVALID_FILE", "Missing required field: file.");
    }

    const uploadFile = uploaded as UploadFileLike;
    const fileName = typeof uploadFile?.name === "string" ? uploadFile.name : "";
    const fileSize = typeof uploadFile?.size === "number" ? uploadFile.size : 0;
    const hasArrayBuffer = typeof uploadFile?.arrayBuffer === "function";

    if (!fileName || fileSize <= 0 || !hasArrayBuffer) {
      return jsonError("INVALID_FILE", "Invalid uploaded file.");
    }

    const ext = path.extname(fileName).toLowerCase().replace(".", "");
    if (!ext) {
      return jsonError("INVALID_FILE", "Uploaded file has no extension.");
    }

    const titleBase = path.basename(fileName, path.extname(fileName));
    const title = titleBase || fileName;

    // demo stage: only txt/pdf are allowed
    if (!["txt", "pdf"].includes(ext)) {
      return jsonError(
        "UNSUPPORTED_FILE_TYPE",
        "Current file format is not supported in Demo. Please upload txt/pdf."
      );
    }

    // Keep method invocation bound to the original File/Blob object.
    const fileBuffer = Buffer.from(await uploadFile.arrayBuffer());

    const documentService = createDocumentService({ db: prisma });
    const document = await documentService.uploadKnowledgeDocument({
      title,
      fileName,
      fileType: ext,
      fileBuffer,
    });

    return NextResponse.json({
      success: true,
      data: {
        document: {
          id: document.id,
          title: document.title,
          fileName: document.fileName,
          fileType: document.fileType,
          status: document.status,
          createdAt: document.createdAt.toISOString(),
          processingError: document.processingError ?? null,
        },
      },
    });
  } catch (err) {
    if (err instanceof DocumentUploadError) {
      return jsonError(err.code, err.message);
    }

    return jsonError("UPLOAD_FAILED", "Upload failed. Please try again.");
  }
}

