"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type PageState = "loading" | "success" | "error";

type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";

interface DocumentRow {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  status: DocumentStatus;
  processingError: string | null;
  createdAt: string;
  updatedAt: string;
}

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type DocumentsApiResponse =
  | {
      success: true;
      data: { documents: DocumentRow[]; pagination: PaginationMeta };
    }
  | { success: false; error: { code: string; message: string } };

const PAGE_SIZE_OPTIONS = [10, 15, 20, 50] as const;

function formatStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case "uploaded":
      return "已上传";
    case "processing":
      return "处理中";
    case "ready":
      return "可用";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

function statusToBadgeVariant(
  status: DocumentStatus
): "default" | "success" | "warning" | "error" {
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

export default function DocumentsManagePage() {
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isLoadingList = state === "loading";

  /** 用于在筛选条件变化的首个渲染周期内立即按第 1 页请求，避免仍用旧 page 多打一次 API */
  const filterPrevRef = useRef({ q: debouncedSearch, s: statusFilter });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filterChanged =
    filterPrevRef.current.q !== debouncedSearch ||
    filterPrevRef.current.s !== statusFilter;
  const listPage = filterChanged ? 1 : page;

  useEffect(() => {
    if (filterChanged) {
      filterPrevRef.current = { q: debouncedSearch, s: statusFilter };
      setPage(1);
      setDocuments([]);
      setPagination((p) => ({
        ...p,
        total: 0,
        totalPages: 1,
        page: 1,
      }));
    }
  }, [debouncedSearch, statusFilter, filterChanged]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(listPage));
    p.set("pageSize", String(pageSize));
    if (debouncedSearch) p.set("q", debouncedSearch);
    if (statusFilter && statusFilter !== "all") p.set("status", statusFilter);
    return p.toString();
  }, [listPage, pageSize, debouncedSearch, statusFilter]);

  const loadDocuments = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/documents?${queryString}`);
      const json = (await res.json()) as DocumentsApiResponse;
      if (!json.success) {
        setState("error");
        setErrorMessage(json.error.message || "加载失败");
        setDocuments((prev) => (prev.length === 0 ? [] : prev));
        return;
      }
      setDocuments(json.data.documents);
      setPagination(json.data.pagination);
      setPage(json.data.pagination.page);
      setState("success");
    } catch {
      setState("error");
      setErrorMessage("加载失败，请检查网络或稍后重试。");
      setDocuments([]);
    }
  }, [queryString]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleDelete(id: string, title: string) {
    const ok = window.confirm(
      `确定要删除文档「${title}」吗？\n\n此为演示环境软删除：列表与知识检索中将不再显示该文档。`
    );
    if (!ok) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as
        | { success: true }
        | { success: false; error: { message: string } };

      if (!res.ok || !json.success) {
        const msg =
          !json.success && "error" in json
            ? json.error.message
            : "删除失败";
        window.alert(msg);
        return;
      }
      await loadDocuments();
    } catch {
      window.alert("删除失败，请稍后重试。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title="文档管理"
          description="查看已上传资料的处理状态，支持按标题/文件名搜索、按状态筛选与演示用软删除。"
          action={
            <Link
              href="/documents"
              className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-white px-4 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-page-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              去上传
            </Link>
          }
        />

        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] underline-offset-4 hover:text-[var(--color-text)] hover:underline"
          >
            ← 返回工作台
          </Link>
        </div>

        <Card className="max-w-5xl">
          <div className="space-y-6">
            <SectionHeader
              title="筛选与搜索"
              description="仅展示未软删除的文档；删除后不会出现在知识问答检索中。"
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <label className="text-sm font-medium text-[var(--color-text)]">
                  搜索（标题或文件名）
                </label>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="输入关键词…"
                  className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div className="w-full space-y-2 sm:w-40">
                <label className="text-sm font-medium text-[var(--color-text)]">
                  状态
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="all">全部</option>
                  <option value="uploaded">已上传</option>
                  <option value="processing">处理中</option>
                  <option value="ready">可用</option>
                  <option value="failed">失败</option>
                </select>
              </div>
              <div className="w-full space-y-2 sm:w-36">
                <label className="text-sm font-medium text-[var(--color-text)]">
                  每页条数
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setPageSize(n);
                    setPage(1);
                    setDocuments([]);
                    setPagination((p) => ({
                      ...p,
                      pageSize: n,
                      total: 0,
                      totalPages: 1,
                      page: 1,
                    }));
                  }}
                  className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} 条/页
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadDocuments()}
                disabled={isLoadingList}
              >
                刷新
              </Button>
            </div>

            {isLoadingList && documents.length === 0 && pagination.total === 0 && (
              <LoadingBlock message="正在加载文档列表…" />
            )}

            {state === "error" && (
              <StatusMessage variant="error" title="加载失败">
                {errorMessage}
              </StatusMessage>
            )}

            {state === "success" && pagination.total === 0 && (
              <EmptyState
                title="暂无文档"
                description="还没有可管理的文档，或当前筛选条件下没有结果。可前往文档上传页添加资料。"
              />
            )}

            {pagination.total > 0 && documents.length > 0 && state !== "error" && (
              <div className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
                <table className="min-w-full divide-y divide-[var(--color-border)] text-left text-sm">
                  <thead className="bg-[var(--color-page-bg)]">
                    <tr>
                      <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                        标题
                      </th>
                      <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                        文件名
                      </th>
                      <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                        状态
                      </th>
                      <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                        上传时间
                      </th>
                      <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] bg-white">
                    {documents.map((d) => (
                      <tr key={d.id} className="align-top">
                        <td className="px-4 py-3 text-[var(--color-text)]">
                          <div className="font-medium">{d.title}</div>
                          {d.status === "failed" && d.processingError ? (
                            <p className="mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">
                              {d.processingError}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text)]">
                          <span className="break-all">{d.fileName}</span>
                          <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                            .{d.fileType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusToBadgeVariant(d.status)}>
                            {formatStatusLabel(d.status)}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                          {formatDateTime(d.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            className="!min-w-0 text-red-600 hover:bg-red-50"
                            disabled={deletingId === d.id}
                            onClick={() => void handleDelete(d.id, d.title)}
                          >
                            {deletingId === d.id ? "删除中…" : "删除"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--color-text-muted)]">
                  共 <span className="font-medium text-[var(--color-text)]">{pagination.total}</span>{" "}
                  条 · 第{" "}
                  <span className="font-medium text-[var(--color-text)]">{pagination.page}</span> /{" "}
                  {pagination.totalPages} 页
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isLoadingList || pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      isLoadingList || pagination.page >= pagination.totalPages
                    }
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                  >
                    下一页
                  </Button>
                </div>
              </div>
              </div>
            )}

            {state === "loading" && documents.length > 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">正在刷新列表…</p>
            )}
          </div>
        </Card>
      </PageContainer>
    </main>
  );
}
