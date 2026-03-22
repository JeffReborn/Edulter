"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
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
  const SUPPORTED_EXTS = useMemo(() => new Set(["txt", "pdf"]), []);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [documentResult, setDocumentResult] = useState<UploadedDocument | null>(null);

  const isUploading = uploadState === "uploading";

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    const ext = getFileExtension(selectedFile.name);
    if (!SUPPORTED_EXTS.has(ext)) {
      setUploadState("error");
      setErrorMessage("当前文件格式暂不支持，请上传 txt/pdf。");
      setDocumentResult(null);
      return;
    }

    setUploadState("uploading");
    setErrorMessage("");
    setDocumentResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

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
    } catch {
      setUploadState("error");
      setErrorMessage("上传失败，请检查网络或稍后重试。");
    }
  }

  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title="文档上传"
          description="上传内部资料（txt/pdf），系统会提取文本并生成可用于问答的知识块。"
          action={
            <Link
              href="/documents/manage"
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-white px-4 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-page-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              文档管理
            </Link>
          }
        />

        <Card className="max-w-3xl">
          <div className="space-y-6">
            <SectionHeader
              title="上传内部资料"
              description="仅支持 txt / pdf"
            />

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text)]">
                  选择文件
                </label>

                <input
                  type="file"
                  accept=".txt,.pdf"
                  disabled={isUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setSelectedFile(f);
                    setUploadState("idle");
                    setErrorMessage("");
                    setDocumentResult(null);
                  }}
                  className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] file:mr-4 file:rounded-md file:border-0 file:bg-[var(--color-page-bg)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                />

                {selectedFile ? (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    已选择：{selectedFile.name}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    请选择一个 txt 或 pdf 文件。
                  </p>
                )}
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

