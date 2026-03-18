import type { KnowledgeDocumentStatus } from "@/generated/prisma/enums";
import type { DbClient } from "@/lib/db";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PDFParse } from "pdf-parse";

export type DocumentUploadErrorCode =
  | "INVALID_FILE"
  | "UNSUPPORTED_FILE_TYPE"
  | "UPLOAD_FAILED"
  | "PROCESSING_INIT_FAILED"
  | "PROCESSING_FAILED";

export class DocumentUploadError extends Error {
  code: DocumentUploadErrorCode;

  constructor(code: DocumentUploadErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DocumentUploadError";
  }
}

const ALLOWED_FILE_TYPES = new Set(["txt", "pdf"]);

// Demo stage: use a simple, stable chunking strategy.
const MAX_CHARS_PER_CHUNK = 1200;
const MIN_MEANINGFUL_TEXT_CHARS = 200;

function normalizeExtractedText(input: string): string {
  // Preserve paragraph structure (blank lines), but normalize noisy whitespace.
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const paragraph of paragraphs) {
    const maybeSep = current ? "\n\n" : "";
    if (current.length + maybeSep.length + paragraph.length <= MAX_CHARS_PER_CHUNK) {
      current += maybeSep + paragraph;
      continue;
    }

    // Flush current chunk first.
    pushCurrent();

    if (paragraph.length <= MAX_CHARS_PER_CHUNK) {
      current = paragraph;
      continue;
    }

    // Paragraph is too long: split it into fixed-length segments.
    for (let i = 0; i < paragraph.length; i += MAX_CHARS_PER_CHUNK) {
      const part = paragraph.slice(i, i + MAX_CHARS_PER_CHUNK).trim();
      if (part) chunks.push(part);
    }
  }

  pushCurrent();
  return chunks;
}

async function extractTextFromFileBuffer(
  fileType: string,
  fileBuffer: Buffer
): Promise<string> {
  if (fileType === "txt") {
    // Assume UTF-8 for demo stage.
    return fileBuffer.toString("utf8");
  }

  if (fileType === "pdf") {
    const parser = new PDFParse({ data: fileBuffer });
    try {
      const textResult = await parser.getText();
      return textResult.text ?? "";
    } finally {
      await parser.destroy();
    }
  }

  // Should be unreachable because caller validates file type.
  return "";
}

function getStatusName(status: KnowledgeDocumentStatus): string {
  return status;
}

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
  const KB_STORAGE_PREFIX = "dev-knowledge-documents";

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
      // New storage strategy (Demo):
      // - storageKey keeps `dev-knowledge-documents/...` prefix
      // - but base directory should be the `storage/` root (avoid nested duplication)
      const storageRootNew =
        process.env.DEV_UPLOADS_DIR ?? path.join(process.cwd(), "storage");
      // Legacy fallback for already stored files (created before this rule fix).
      // Best-effort: if file doesn't exist in the new location, try legacy.
      const storageRootLegacy =
        process.env.DEV_UPLOADS_DIR ??
        path.join(process.cwd(), "storage", "dev-knowledge-documents");

      const storageFileName = sanitizeStorageFileName(fileName);
      const storageId = crypto.randomUUID();
      const storageKey = `${KB_STORAGE_PREFIX}/${storageId}/${storageFileName}`;

      const storagePathNew = path.join(storageRootNew, storageKey);
      const storagePathLegacy = path.join(storageRootLegacy, storageKey);

      try {
        await fs.mkdir(path.dirname(storagePathNew), { recursive: true });
        await fs.writeFile(storagePathNew, fileBuffer);
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

        // Task Card 05: ingestion after upload (txt/pdf text extraction + chunking).
        try {
          await db.knowledgeDocument.update({
            where: { id: created.id },
            data: { status: "processing" },
          });

          // Read back from storage (new location first; then legacy fallback).
          let storedBuffer: Buffer;
          try {
            storedBuffer = await fs.readFile(storagePathNew);
          } catch (err) {
            const legacyErr = err as NodeJS.ErrnoException;
            if (legacyErr?.code === "ENOENT") {
              storedBuffer = await fs.readFile(storagePathLegacy);
              // Keep future reads consistent if we found a legacy file.
              await fs.mkdir(path.dirname(storagePathNew), { recursive: true });
              await fs.copyFile(storagePathLegacy, storagePathNew);
            } else {
              throw err;
            }
          }
          const extractedText = await extractTextFromFileBuffer(
            created.fileType,
            storedBuffer
          );
          const normalizedText = normalizeExtractedText(extractedText);

          if (
            !normalizedText ||
            normalizedText.replace(/\s+/g, "").length < MIN_MEANINGFUL_TEXT_CHARS
          ) {
            await db.knowledgeDocument.update({
              where: { id: created.id },
              data: { status: "failed", rawText: null },
            });
            console.error(
              `[documentService] Ingestion failed: empty/unusable text. docId=${created.id}`
            );
            throw new DocumentUploadError(
              "PROCESSING_FAILED",
              "Document processing failed. Please try again."
            );
          }

          const chunks = chunkText(normalizedText);
          if (chunks.length === 0) {
            await db.knowledgeDocument.update({
              where: { id: created.id },
              data: { status: "failed", rawText: null },
            });
            console.error(
              `[documentService] Ingestion failed: produced zero chunks. docId=${created.id}`
            );
            throw new DocumentUploadError(
              "PROCESSING_FAILED",
              "Document processing failed. Please try again."
            );
          }

          await db.$transaction(async (tx) => {
            // Idempotency: if ingestion is retried, ensure no duplicate chunks.
            await tx.documentChunk.deleteMany({
              where: { documentId: created.id },
            });

            await tx.documentChunk.createMany({
              data: chunks.map((content, chunkIndex) => ({
                documentId: created.id,
                chunkIndex,
                content,
              })),
            });

            await tx.knowledgeDocument.update({
              where: { id: created.id },
              data: { status: "ready", rawText: normalizedText },
            });
          });

          return {
            id: created.id,
            title: created.title,
            fileName: created.fileName,
            fileType: created.fileType,
            status: "ready",
            createdAt: created.createdAt,
          };
        } catch (err) {
          // Ensure lifecycle ends in a deterministic state.
          try {
            await db.knowledgeDocument.update({
              where: { id: created.id },
              data: { status: "failed", rawText: null },
            });
          } catch {
            // Ignore secondary failures; original error will be logged.
          }

          console.error(
            `[documentService] Ingestion failed. docId=${created.id}, status=${getStatusName(
              created.status
            )}`,
            err
          );
          throw new DocumentUploadError(
            "PROCESSING_FAILED",
            "Document processing failed. Please try again."
          );
        }
      } catch (err) {
        if (err instanceof DocumentUploadError) {
          throw err;
        }
        throw new DocumentUploadError(
          "PROCESSING_INIT_FAILED",
          "Failed to create document record."
        );
      }
    },
  };
}

