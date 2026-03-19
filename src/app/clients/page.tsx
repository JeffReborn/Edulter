"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type ClientsApiResponse =
  | { success: true; data: { clients: ClientListItem[] } }
  | { success: false; error: { code: string; message: string } };

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
  switch (stage) {
    case "new_lead":
      return "新线索";
    case "initial_consultation":
      return "首咨中";
    case "in_followup":
      return "跟进中";
    case "high_intent":
      return "高意向";
    case "uncertain":
      return "待判断";
    case "closed":
      return "已关闭";
    default:
      return stage;
  }
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

function FieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text)]">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export default function ClientsPage() {
  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [clients, setClients] = useState<ClientListItem[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadClients() {
      setState("loading");
      setErrorMessage("");

      try {
        const res = await fetch("/api/clients", { method: "GET" });
        const json = (await res.json()) as ClientsApiResponse;

        if (!mounted) return;

        if (!json.success) {
          setState("error");
          setErrorMessage(json.error.message || "客户列表加载失败，请稍后重试。");
          return;
        }

        setClients(json.data.clients);
        setState("success");
      } catch {
        if (!mounted) return;
        setState("error");
        setErrorMessage("网络或服务异常，请检查后重试。");
      }
    }

    loadClients();
    return () => {
      mounted = false;
    };
  }, []);

  const hasClients = useMemo(() => clients.length > 0, [clients.length]);

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

        <Card className="max-w-5xl">
          <div className="space-y-6">
            <SectionHeader
              title="客户列表"
              description="默认按最近更新时间排序，仅展示轻量摘要字段。"
            />

            {state === "loading" && <LoadingBlock message="正在加载客户记录…" />}

            {state === "error" && (
              <StatusMessage variant="error" title="加载失败">
                {errorMessage}
              </StatusMessage>
            )}

            {state === "success" && !hasClients && (
              <EmptyState
                title="当前还没有客户记录"
                description="请先在“客户画像提取”页面提交咨询文本，系统会创建客户并沉淀画像记录。"
                action={
                  <Link href="/profiles">
                    <Button variant="primary">去提取客户画像</Button>
                  </Link>
                }
              />
            )}

            {state === "success" && hasClients && (
              <div className="space-y-4">
                {clients.map((client) => (
                  <Card key={client.id} className="bg-[var(--color-card-bg)]">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-medium text-[var(--color-text)]">
                            {client.displayName}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            最近更新：{formatDateTime(client.updatedAt)}
                          </p>
                        </div>
                        <Badge variant={stageBadgeVariant(client.currentStage)}>
                          {stageLabel(client.currentStage)}
                        </Badge>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <FieldRow label="学生阶段" value={client.studentStage} />
                        <FieldRow label="目标国家" value={client.targetCountry} />
                        <FieldRow label="画像记录" value={client.hasProfile ? "已存在" : "暂无"} />
                        <FieldRow label="跟进消息" value={client.hasFollowup ? "已生成" : "暂无"} />
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                        <p className="text-xs text-[var(--color-text-muted)]">客户 ID：{client.id}</p>
                        <Link href={`/clients/${client.id}`}>
                          <Button variant="ghost">查看详情</Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </PageContainer>
    </main>
  );
}
