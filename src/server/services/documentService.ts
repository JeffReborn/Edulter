import type { KnowledgeDocumentStatus } from "@/generated/prisma/enums";
import type { DbClient } from "@/lib/db";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type DocumentUploadErrorCode =
  | "INVALID_FILE"
  | "UNSUPPORTED_FILE_TYPE"
  | "UPLOAD_FAILED"
  | "PROCESSING_INIT_FAILED";

export class DocumentUploadError extends Error {
  code: DocumentUploadErrorCode;

  constructor(code: DocumentUploadErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DocumentUploadError";
  }
}

const ALLOWED_FILE_TYPES = new Set(["txt", "pdf"]);

function sanitizeStorageFileName(fileName: string): string {
  const base = path.basename(fileName);
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "document";
}

export interface DocumentServiceDeps {
  db: DbClient;
}

export interface CreateKnowledgeDocumentInput {
  title: string;
  fileName: string;
  fileType: string;
  storageKey: string;
  uploadedById?: string;
}

export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  status: KnowledgeDocumentStatus;
  createdAt: Date;
}

export interface UploadKnowledgeDocumentInput {
  title: string;
  fileName: string;
  fileType: string; // demo stage: extension (txt/pdf)
  fileBuffer: Buffer;
  uploadedById?: string;
}

export interface UploadedKnowledgeDocument {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  status: KnowledgeDocumentStatus;
  createdAt: Date;
}

export function createDocumentService(deps: DocumentServiceDeps) {
  const { db } = deps;

  return {
    /**
     * 后续任务卡会在这里实现：
     * - 创建文档记录
     * - 更新状态
     * - 读取单个或列表
     */
    async getDocumentById(
      id: string
    ): Promise<KnowledgeDocumentSummary | null> {
      return db.knowledgeDocument.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          fileName: true,
          fileType: true,
          status: true,
          storageKey: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    },

    async listRecentDocuments(
      _limit: number
    ): Promise<KnowledgeDocumentSummary[]> {
      // 仅提供一个简单可扩展的骨架，后续任务卡再补充过滤/分页细节
      const docs = await db.knowledgeDocument.findMany({
        orderBy: { createdAt: "desc" },
        take: _limit,
      });

      return docs.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        createdAt: d.createdAt,
      }));
    },

    /**
     * Task Card 04 - 仅做 Demo 阶段的最小上传闭环：
     * 1) 校验文件类型（仅 txt/pdf）
     * 2) 将文件落到本地 dev 目录（不是生产级对象存储）
     * 3) 创建 `knowledge_documents` 初始记录，状态置为 uploaded
     *
     * 本方法不做：文本提取、chunking、embedding、检索/RAG。
     */
    async uploadKnowledgeDocument(
      input: UploadKnowledgeDocumentInput
    ): Promise<UploadedKnowledgeDocument> {
      const { title, fileName, fileType, fileBuffer, uploadedById } = input;

      if (!fileName || !fileType) {
        throw new DocumentUploadError(
          "INVALID_FILE",
          "Invalid file: missing file name or file type."
        );
      }

      if (!ALLOWED_FILE_TYPES.has(fileType)) {
        throw new DocumentUploadError(
          "UNSUPPORTED_FILE_TYPE",
          `Unsupported file type: ${fileType}. Only txt/pdf are supported in Demo.`
        );
      }

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        throw new DocumentUploadError("INVALID_FILE", "Uploaded file is empty.");
      }

      // Storage strategy (Demo fallback):
      // - 若你未来接入 S3/Supabase Storage，可替换这里的本地落盘逻辑
      // - 当前实现明确是 dev/stage 级别：写到本地项目目录下，供后续模块读取 storageKey
      const baseDir =
        process.env.DEV_UPLOADS_DIR ??
        path.join(process.cwd(), "storage", "dev-knowledge-documents");

      const storageFileName = sanitizeStorageFileName(fileName);
      const storageId = crypto.randomUUID();
      const storageKey = `dev-knowledge-documents/${storageId}/${storageFileName}`;

      const storagePath = path.join(baseDir, storageKey);

      try {
        await fs.mkdir(path.dirname(storagePath), { recursive: true });
        await fs.writeFile(storagePath, fileBuffer);
      } catch {
        throw new DocumentUploadError(
          "UPLOAD_FAILED",
          "File storage failed. Please try again."
        );
      }

      try {
        const created = await db.knowledgeDocument.create({
          data: {
            title,
            fileName,
            fileType,
            storageKey,
            status: "uploaded",
            rawText: null,
            uploadedById: uploadedById ?? null,
          },
        });

        return {
          id: created.id,
          title: created.title,
          fileName: created.fileName,
          fileType: created.fileType,
          status: created.status,
          createdAt: created.createdAt,
        };
      } catch {
        throw new DocumentUploadError(
          "PROCESSING_INIT_FAILED",
          "Failed to create document record."
        );
      }
    },
  };
}

