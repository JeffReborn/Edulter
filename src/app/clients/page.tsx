"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingBlock,
  PageContainer,
  PageHeader,
  SectionHeader,
  StatusMessage,
} from "@/components";

type PageState = "loading" | "success" | "error";

type ClientStage =
  | "new_lead"
  | "initial_consultation"
  | "in_followup"
  | "high_intent"
  | "uncertain"
  | "closed";

interface ClientListItem {
  id: string;
  displayName: string;
  studentStage: string | null;
  targetCountry: string | null;
  currentStage: ClientStage;
  updatedAt: string;
  hasProfile: boolean;
  hasFollowup: boolean;
}

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ClientsApiResponse =
  | {
      success: true;
      data: { clients: ClientListItem[]; pagination: PaginationMeta };
    }
  | { success: false; error: { code: string; message: string } };

const PAGE_SIZE_OPTIONS = [10, 15, 20, 50] as const;

const STAGE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "全部" },
  { value: "new_lead", label: "新线索" },
  { value: "initial_consultation", label: "首咨中" },
  { value: "in_followup", label: "跟进中" },
  { value: "high_intent", label: "高意向" },
  { value: "uncertain", label: "待判断" },
  { value: "closed", label: "已关闭" },
];

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

function stageLabel(stage: ClientStage): string {
  const row = STAGE_FILTER_OPTIONS.find((o) => o.value === stage);
  return row?.label ?? stage;
}

function stageBadgeVariant(stage: ClientStage): "default" | "success" | "warning" | "error" {
  switch (stage) {
    case "high_intent":
      return "success";
    case "in_followup":
    case "initial_consultation":
      return "default";
    case "uncertain":
      return "warning";
    case "closed":
      return "error";
    default:
      return "default";
  }
}

type PatchDisplayNameResponse =
  | { success: true; data: { id: string; displayName: string } }
  | { success: false; error: { code: string; message: string } };

export default function ClientsPage() {
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  });
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [renaming, setRenaming] = useState(false);

  const isLoadingList = state === "loading";

  const filterPrevRef = useRef({ q: debouncedSearch, s: stageFilter });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filterChanged =
    filterPrevRef.current.q !== debouncedSearch ||
    filterPrevRef.current.s !== stageFilter;
  const listPage = filterChanged ? 1 : page;

  useEffect(() => {
    if (filterChanged) {
      filterPrevRef.current = { q: debouncedSearch, s: stageFilter };
      setPage(1);
      setClients([]);
      setPagination((p) => ({
        ...p,
        total: 0,
        totalPages: 1,
        page: 1,
      }));
      setEditingClientId(null);
    }
  }, [debouncedSearch, stageFilter, filterChanged]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(listPage));
    p.set("pageSize", String(pageSize));
    if (debouncedSearch) p.set("q", debouncedSearch);
    if (stageFilter && stageFilter !== "all") p.set("stage", stageFilter);
    return p.toString();
  }, [listPage, pageSize, debouncedSearch, stageFilter]);

  const loadClients = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/clients?${queryString}`);
      const json = (await res.json()) as ClientsApiResponse;

      if (!json.success) {
        setState("error");
        setErrorMessage(json.error.message || "客户列表加载失败，请稍后重试。");
        setClients((prev) => (prev.length === 0 ? [] : prev));
        return;
      }

      setClients(json.data.clients);
      setPagination(json.data.pagination);
      setPage(json.data.pagination.page);
      setState("success");
    } catch {
      setState("error");
      setErrorMessage("网络或服务异常，请检查后重试。");
      setClients([]);
    }
  }, [queryString]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  async function commitDisplayName(clientId: string, original: string, value: string) {
    const next = value.trim();
    setInlineError("");
    if (next === original) {
      setEditingClientId(null);
      return;
    }
    setRenaming(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: next }),
      });
      const json = (await res.json()) as PatchDisplayNameResponse;
      if (!json.success) {
        setInlineError(json.error.message || "更新失败，请重试。");
        setRenaming(false);
        return;
      }
      setEditingClientId(null);
      await loadClients();
    } catch {
      setInlineError("网络或服务异常，请稍后重试。");
    } finally {
      setRenaming(false);
    }
  }

  const hasActiveFilters = debouncedSearch !== "" || stageFilter !== "all";

  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title="客户记录"
          description="查看已沉淀的客户摘要信息，并进入客户详情页继续处理。"
          action={
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md px-4 font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              返回首页
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
              description="默认按最近更新时间排序；支持按显示名、学生姓名搜索，按阶段筛选。"
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <label className="text-sm font-medium text-[var(--color-text)]">
                  搜索（显示名或学生姓名）
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
                <label className="text-sm font-medium text-[var(--color-text)]">阶段</label>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text)] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {STAGE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full space-y-2 sm:w-36">
                <label className="text-sm font-medium text-[var(--color-text)]">每页条数</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setPageSize(n);
                    setPage(1);
                    setClients([]);
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
                onClick={() => void loadClients()}
                disabled={isLoadingList}
              >
                刷新
              </Button>
            </div>

            {isLoadingList && clients.length === 0 && pagination.total === 0 && (
              <LoadingBlock message="正在加载客户记录…" />
            )}

            {state === "error" && (
              <StatusMessage variant="error" title="加载失败">
                {errorMessage}
              </StatusMessage>
            )}

            {state === "success" && pagination.total === 0 && (
              <EmptyState
                title={hasActiveFilters ? "没有符合条件的客户" : "当前还没有客户记录"}
                description={
                  hasActiveFilters
                    ? "请调整搜索关键词或阶段筛选，或点击「刷新」重试。"
                    : "请先在「新建客户画像」页面提交咨询文本，系统会创建客户并沉淀画像记录。"
                }
                action={
                  !hasActiveFilters ? (
                    <Link href="/profiles">
                      <Button variant="primary">去新建客户画像</Button>
                    </Link>
                  ) : undefined
                }
              />
            )}

            {pagination.total > 0 && clients.length > 0 && state !== "error" && (
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
                  <table className="min-w-full divide-y divide-[var(--color-border)] text-left text-sm">
                    <thead className="bg-[var(--color-page-bg)]">
                      <tr>
                        <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                          显示名
                        </th>
                        <th className="px-4 py-3 font-medium text-[var(--color-text)]">阶段</th>
                        <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                          学生阶段
                        </th>
                        <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                          目标国家
                        </th>
                        <th className="px-4 py-3 font-medium text-[var(--color-text)]">画像</th>
                        <th className="px-4 py-3 font-medium text-[var(--color-text)]">跟进</th>
                        <th className="px-4 py-3 font-medium text-[var(--color-text)]">
                          最近更新
                        </th>
                        <th className="px-4 py-3 font-medium text-[var(--color-text)]">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] bg-white">
                      {clients.map((client) => (
                        <tr key={client.id} className="align-top">
                          <td className="px-4 py-3 text-[var(--color-text)]">
                            {editingClientId === client.id ? (
                              <div className="min-w-[10rem] space-y-1">
                                <Input
                                  value={draftDisplayName}
                                  onChange={(e) => setDraftDisplayName(e.target.value)}
                                  disabled={renaming}
                                  autoFocus
                                  onBlur={(e) =>
                                    void commitDisplayName(
                                      client.id,
                                      client.displayName,
                                      e.currentTarget.value
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      (e.currentTarget as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-full max-w-xs"
                                />
                                {inlineError ? (
                                  <p className="text-xs text-red-600">{inlineError}</p>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="font-medium">{client.displayName}</span>
                                <button
                                  type="button"
                                  disabled={renaming}
                                  onClick={() => {
                                    setEditingClientId(client.id);
                                    setDraftDisplayName(client.displayName);
                                    setInlineError("");
                                  }}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:opacity-50"
                                  aria-label="编辑显示名"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                  >
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            <p className="mt-1 break-all font-mono text-xs text-[var(--color-text-muted)]">
                              {client.id}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={stageBadgeVariant(client.currentStage)}>
                              {stageLabel(client.currentStage)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text)]">
                            {client.studentStage?.trim() ? client.studentStage : "—"}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text)]">
                            {client.targetCountry?.trim() ? client.targetCountry : "—"}
                          </td>
                          <td
                            className={
                              client.hasProfile
                                ? "px-4 py-3 text-green-700"
                                : "px-4 py-3 text-[var(--color-text-muted)]"
                            }
                          >
                            {client.hasProfile ? "已存在" : "暂无"}
                          </td>
                          <td
                            className={
                              client.hasFollowup
                                ? "px-4 py-3 text-green-700"
                                : "px-4 py-3 text-[var(--color-text-muted)]"
                            }
                          >
                            {client.hasFollowup ? "已生成" : "暂无"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-muted)]">
                            {formatDateTime(client.updatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/clients/${client.id}`}
                              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                            >
                              查看详情
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    共{" "}
                    <span className="font-medium text-[var(--color-text)]">{pagination.total}</span>{" "}
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
                      disabled={isLoadingList || pagination.page >= pagination.totalPages}
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

            {state === "loading" && clients.length > 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">正在刷新列表…</p>
            )}
          </div>
        </Card>
      </PageContainer>
    </main>
  );
}
