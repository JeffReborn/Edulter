"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  PageContainer,
  PageHeader,
  SectionHeader,
  StatusMessage,
} from "@/components";

type UploadState = "idle" | "uploading" | "success" | "error";

type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";

type UploadDocumentResponse =
  | {
      success: true;
      data: {
        document: {
          id: string;
          title: string;
          fileName: string;
          fileType: string;
          status: DocumentStatus;
          createdAt: string;
          processingError?: string | null;
        };
      };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

type UploadedDocument = Extract<UploadDocumentResponse, { success: true }>["data"]["document"];

type CheckDuplicateResponse =
  | {
      success: true;
      data: { exists: false };
    }
  | {
      success: true;
      data: {
        exists: true;
        document: {
          id: string;
          title: string;
          fileName: string;
          status: DocumentStatus;
        };
      };
    };

const SUPPORTED_UPLOAD_EXTS = new Set(["txt", "pdf"]);
const SUPPORTED_UPLOAD_LABEL = "txt、pdf";

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

function formatStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case "uploaded":
      return "Uploaded";
    case "processing":
      return "Processing";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusToBadgeVariant(status: DocumentStatus): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "ready":
      return "success";
    case "processing":
      return "warning";
    case "failed":
      return "error";
    default:
      return "default";
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [documentResult, setDocumentResult] = useState<UploadedDocument | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [dragFormatError, setDragFormatError] = useState<string>("");
  const [duplicateDialog, setDuplicateDialog] = useState<{
    title: string;
    fileName: string;
  } | null>(null);

  const isUploading = uploadState === "uploading";

  useEffect(() => {
    if (!duplicateDialog || isUploading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDuplicateDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duplicateDialog, isUploading]);

  function clearFileInput() {
    const input = fileInputRef.current;
    if (!input) return;
    try {
      input.value = "";
    } catch {
      /* ignore */
    }
  }

  /** 将文件同步到原生 file input，使「选择文件」旁显示文件名（拖放场景依赖此项）。 */
  function syncFileToInput(file: File) {
    const input = fileInputRef.current;
    if (!input) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    } catch {
      /* 极少数环境可能不支持赋值 files */
    }
  }

  /** @returns 是否已接受为待上传文件 */
  function applySelectedFile(file: File | null): boolean {
    setDuplicateDialog(null);
    if (!file) {
      setSelectedFile(null);
      clearFileInput();
      return false;
    }
    const ext = getFileExtension(file.name);
    if (!ext) {
      setDragFormatError(
        `当前文件没有扩展名，仅支持上传 ${SUPPORTED_UPLOAD_LABEL} 格式的文件。`
      );
      setSelectedFile(null);
      setUploadState("idle");
      clearFileInput();
      return false;
    }
    if (!SUPPORTED_UPLOAD_EXTS.has(ext)) {
      setDragFormatError(
        `您选择的是 .${ext} 格式，当前仅支持上传 ${SUPPORTED_UPLOAD_LABEL} 格式的文件。`
      );
      setSelectedFile(null);
      setUploadState("idle");
      clearFileInput();
      return false;
    }
    setDragFormatError("");
    setSelectedFile(file);
    setUploadState("idle");
    setErrorMessage("");
    setDocumentResult(null);
    syncFileToInput(file);
    return true;
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    dragDepthRef.current += 1;
    setDropActive(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDropActive(false);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDropActive(false);
    if (isUploading) return;

    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) {
      setDragFormatError("未检测到有效文件，请拖入单个 txt 或 pdf 文件。");
      return;
    }
    if (files.length > 1) {
      setDragFormatError(
        `一次仅支持上传一个文件，请只拖入一个 ${SUPPORTED_UPLOAD_LABEL} 文件。`
      );
      setSelectedFile(null);
      setUploadState("idle");
      clearFileInput();
      return;
    }

    const file = files[0];
    if (file.size <= 0) {
      setDragFormatError("文件为空或无法读取，请换其他文件重试。");
      setSelectedFile(null);
      setUploadState("idle");
      clearFileInput();
      return;
    }

    applySelectedFile(file);
  }

  async function startUpload(replaceExisting: boolean) {
    if (!selectedFile || isUploading) return;

    const ext = getFileExtension(selectedFile.name);
    if (!SUPPORTED_UPLOAD_EXTS.has(ext)) {
      setUploadState("error");
      setErrorMessage(
        `当前文件格式暂不支持，请上传 ${SUPPORTED_UPLOAD_LABEL} 格式的文件。`
      );
      setDocumentResult(null);
      return;
    }

    if (!replaceExisting) {
      try {
        const checkRes = await fetch(
          `/api/documents/check-duplicate?fileName=${encodeURIComponent(selectedFile.name)}`
        );
        const checkJson = (await checkRes.json()) as CheckDuplicateResponse;
        if (
          checkJson.success &&
          checkJson.data.exists &&
          "document" in checkJson.data
        ) {
          const d = checkJson.data.document;
          setDuplicateDialog({ title: d.title, fileName: d.fileName });
          return;
        }
      } catch {
        /* 预检失败则继续上传，由服务端 409 兜底 */
      }
    }

    setDuplicateDialog(null);
    setUploadState("uploading");
    setErrorMessage("");
    setDragFormatError("");
    setDocumentResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (replaceExisting) {
        formData.append("replaceExisting", "true");
      }

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as UploadDocumentResponse;
      if (!json.success) {
        setUploadState("error");
        setErrorMessage(json.error.message || "上传失败，请重试。");
        return;
      }

      setUploadState("success");
      setDocumentResult(json.data.document);
      setSelectedFile(null);
      clearFileInput();
      dragDepthRef.current = 0;
      setDropActive(false);
    } catch {
      setUploadState("error");
      setErrorMessage("上传失败，请检查网络或稍后重试。");
    }
  }

  function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void startUpload(false);
  }

  return (
    <main className="min-h-screen">
      {duplicateDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => !isUploading && setDuplicateDialog(null)}
        >
          <Card
            className="relative w-full max-w-md shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-dialog-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="space-y-4">
              <p
                id="duplicate-dialog-title"
                className="text-base font-semibold text-[var(--color-text)]"
              >
                同名文件已存在
              </p>
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                当前知识库已存在「{duplicateDialog.title}」（
                {duplicateDialog.fileName}）。是否仍要上传？上传<strong>成功</strong>
                后将用新文件替换同名旧条目（旧条目将从列表移除且不再参与检索）；若本次处理
                <strong>失败</strong>，旧条目仍保留，本次上传会显示为失败状态。
              </p>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isUploading}
                  onClick={() => setDuplicateDialog(null)}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={isUploading}
                  onClick={() => {
                    void startUpload(true);
                  }}
                >
                  {isUploading ? "上传中…" : "确定上传并覆盖"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <PageContainer>
        <PageHeader
          title="文档上传"
          description="上传内部资料（txt/pdf），系统会提取文本并生成可用于问答的知识块。"
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/documents/manage"
                className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-white px-4 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-page-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                文档管理
              </Link>
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center rounded-md px-4 font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                返回首页
              </Link>
            </div>
          }
        />

        <Card className="w-full">
          <div className="space-y-6">
            <SectionHeader
              title="上传内部资料"
              description="仅支持 txt / pdf"
            />

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text)]">
                  选择或拖放文件
                </label>

                <div
                  role="region"
                  aria-label="文件拖放区域"
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`rounded-lg border-2 border-dashed px-4 py-6 transition-colors sm:px-6 sm:py-8 ${
                    isUploading
                      ? "pointer-events-none border-[var(--color-border)] bg-[var(--color-page-bg)] opacity-70"
                      : dropActive
                        ? "border-[var(--color-primary)] bg-blue-50/60"
                        : "border-[var(--color-border)] bg-[var(--color-page-bg)]"
                  }`}
                >
                  <p className="mb-4 text-center text-sm text-[var(--color-text-muted)]">
                    将 txt / pdf 文件拖放到此处，或点击下方选择文件
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf"
                    disabled={isUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) {
                        setDuplicateDialog(null);
                        setSelectedFile(null);
                        setUploadState("idle");
                        setErrorMessage("");
                        setDragFormatError("");
                        setDocumentResult(null);
                        clearFileInput();
                        return;
                      }
                      applySelectedFile(f);
                    }}
                    className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] file:mr-4 file:rounded-md file:border-0 file:bg-[var(--color-page-bg)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                {dragFormatError ? (
                  <div role="alert" aria-live="polite">
                    <StatusMessage variant="error" title="无法使用该文件">
                      {dragFormatError}
                    </StatusMessage>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  variant="primary"
                  className="min-w-[160px]"
                >
                  {isUploading ? "上传中…" : "上传文档"}
                </Button>
              </div>
            </form>

            <div className="border-t border-[var(--color-border)] pt-6">
              {uploadState === "idle" && (
                <EmptyState
                  title="尚未上传文档"
                  description="选择 txt/pdf 文件后点击“上传文档”，即可查看处理状态。"
                />
              )}

              {uploadState === "uploading" && <LoadingBlock message="正在上传并处理文档…" />}

              {uploadState === "error" && (
                <StatusMessage variant="error" title="上传失败">
                  {errorMessage}
                </StatusMessage>
              )}

              {uploadState === "success" && documentResult && (
                <Card className="mt-4 bg-[var(--color-card-bg)]">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm text-[var(--color-text-muted)]">文档标题</p>
                        <p className="mt-1 text-base font-semibold text-[var(--color-text)]">
                          {documentResult.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={statusToBadgeVariant(documentResult.status)}>
                          {formatStatusLabel(documentResult.status)}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-[var(--color-text-muted)]">文件名</p>
                        <p className="mt-1 text-sm text-[var(--color-text)]">
                          {documentResult.fileName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-[var(--color-text-muted)]">上传时间</p>
                        <p className="mt-1 text-sm text-[var(--color-text)]">
                          {formatDateTime(documentResult.createdAt)}
                        </p>
                      </div>
                    </div>

                    {documentResult.status === "failed" &&
                    documentResult.processingError ? (
                      <StatusMessage variant="error" title="处理失败说明">
                        {documentResult.processingError}
                      </StatusMessage>
                    ) : (
                      <p className="text-sm text-[var(--color-text-muted)]">
                        文档处理完成后即可用于后续知识问答。
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </Card>
      </PageContainer>
    </main>
  );
}

