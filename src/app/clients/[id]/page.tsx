"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

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

type PageState = "loading" | "success" | "error" | "not_found";
type ClientStage =
  | "new_lead"
  | "initial_consultation"
  | "in_followup"
  | "high_intent"
  | "uncertain"
  | "closed";
type FollowupStyleType = "wechat_short" | "semi_formal" | "english_optional";

interface ClientDetailData {
  client: {
    id: string;
    displayName: string;
    studentStage: string | null;
    targetCountry: string | null;
    budgetRange: string | null;
    currentStage: ClientStage;
    createdAt: string;
    updatedAt: string;
  };
  latestConversationRecord: {
    id: string;
    rawText: string;
    createdAt: string;
  } | null;
  latestProfile: {
    id: string;
    studentStage: string | null;
    targetCountry: string | null;
    targetProgram: string | null;
    budgetRange: string | null;
    timeline: string | null;
    englishLevel: string | null;
    parentGoals: string[];
    mainConcerns: string[];
    riskFlags: string[];
    currentStage: ClientStage;
    structuredJson: Record<string, unknown>;
    createdAt: string;
  } | null;
  latestFollowups: Array<{
    id: string;
    styleType: FollowupStyleType;
    content: string;
    createdAt: string;
  }>;
}

type ClientDetailApiResponse =
  | { success: true; data: ClientDetailData }
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

function styleLabel(style: FollowupStyleType): string {
  if (style === "wechat_short") return "微信简短版";
  if (style === "semi_formal") return "稍正式版";
  return "可选英文版";
}

function FieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text)]">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

function StringList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">暂无</p>;
  }

  return (
    <ul className="space-y-1">
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`} className="text-sm text-[var(--color-text)]">
          - {item}
        </li>
      ))}
    </ul>
  );
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = useMemo(() => (params?.id ?? "").trim(), [params?.id]);

  const [state, setState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [detail, setDetail] = useState<ClientDetailData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDetail() {
      if (!clientId) {
        setState("not_found");
        return;
      }

      setState("loading");
      setErrorMessage("");

      try {
        const res = await fetch(`/api/clients/${clientId}`, { method: "GET" });
        const json = (await res.json()) as ClientDetailApiResponse;

        if (!mounted) return;

        if (!json.success) {
          if (json.error.code === "CLIENT_NOT_FOUND") {
            setState("not_found");
            return;
          }
          setState("error");
          setErrorMessage(json.error.message || "客户详情加载失败，请稍后重试。");
          return;
        }

        setDetail(json.data);
        setState("success");
      } catch {
        if (!mounted) return;
        setState("error");
        setErrorMessage("网络或服务异常，请检查后重试。");
      }
    }

    loadDetail();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  const latestConversationText = detail?.latestConversationRecord?.rawText ?? "";
  const clippedConversationText =
    latestConversationText.length > 1200
      ? `${latestConversationText.slice(0, 1200)}\n\n（内容较长，已截断展示）`
      : latestConversationText;

  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title={detail?.client.displayName ? `客户详情｜${detail.client.displayName}` : "客户详情"}
          description="查看该客户最新咨询、最新画像与最近跟进结果。"
          action={
            <div className="flex items-center gap-2">
              <Link href="/clients">
                <Button variant="secondary">返回客户列表</Button>
              </Link>
              <Link href="/">
                <Button variant="ghost">返回首页</Button>
              </Link>
            </div>
          }
        />

        {state === "loading" && <LoadingBlock message="正在加载客户详情…" className="max-w-5xl" />}

        {state === "error" && (
          <Card className="max-w-5xl">
            <StatusMessage variant="error" title="加载失败">
              {errorMessage}
            </StatusMessage>
          </Card>
        )}

        {state === "not_found" && (
          <Card className="max-w-5xl">
            <EmptyState
              title="当前客户记录不存在"
              description="该客户可能尚未创建或记录已失效，请返回客户列表重新选择。"
              action={
                <Link href="/clients">
                  <Button variant="primary">返回客户列表</Button>
                </Link>
              }
            />
          </Card>
        )}

        {state === "success" && detail && (
          <div className="max-w-5xl space-y-5">
            <Card>
              <div className="space-y-5">
                <SectionHeader title="客户基础信息" description="展示客户主体摘要，不包含编辑操作。" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium text-[var(--color-text)]">
                      {detail.client.displayName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      客户 ID：{detail.client.id}
                    </p>
                  </div>
                  <Badge variant={stageBadgeVariant(detail.client.currentStage)}>
                    {stageLabel(detail.client.currentStage)}
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FieldRow label="学生阶段" value={detail.client.studentStage} />
                  <FieldRow label="目标国家" value={detail.client.targetCountry} />
                  <FieldRow label="预算范围" value={detail.client.budgetRange} />
                  <FieldRow label="创建时间" value={formatDateTime(detail.client.createdAt)} />
                  <FieldRow label="最近更新" value={formatDateTime(detail.client.updatedAt)} />
                  <FieldRow label="当前阶段" value={stageLabel(detail.client.currentStage)} />
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <SectionHeader title="最近咨询记录" description="仅展示最近一次咨询文本。" />
                {!detail.latestConversationRecord ? (
                  <EmptyState
                    title="该客户暂未保存咨询内容"
                    description="请使用「新建客户画像」或在本页「更新客户画像」提交咨询文本。"
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      记录时间：{formatDateTime(detail.latestConversationRecord.createdAt)}
                    </p>
                    <div className="rounded-md border border-[var(--color-border)] bg-white px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
                        {clippedConversationText}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <SectionHeader title="最新客户画像" description="按结构化字段展示可读摘要。" />
                {!detail.latestProfile ? (
                  <EmptyState
                    title="该客户暂未生成画像"
                    description="请先完成新建或更新客户画像后再查看该区块。"
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <FieldRow label="学生阶段" value={detail.latestProfile.studentStage} />
                      <FieldRow label="目标国家" value={detail.latestProfile.targetCountry} />
                      <FieldRow label="目标项目" value={detail.latestProfile.targetProgram} />
                      <FieldRow label="预算范围" value={detail.latestProfile.budgetRange} />
                      <FieldRow label="时间线" value={detail.latestProfile.timeline} />
                      <FieldRow label="英语水平" value={detail.latestProfile.englishLevel} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">家长目标</p>
                        <div className="mt-1">
                          <StringList items={detail.latestProfile.parentGoals} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">主要关注点</p>
                        <div className="mt-1">
                          <StringList items={detail.latestProfile.mainConcerns} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">风险提示</p>
                        <div className="mt-1">
                          <StringList items={detail.latestProfile.riskFlags} />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      画像生成时间：{formatDateTime(detail.latestProfile.createdAt)}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <SectionHeader
                  title="最近跟进结果"
                  description="默认展示最近 5 条已生成的跟进消息草稿。"
                />
                {detail.latestFollowups.length === 0 ? (
                  <EmptyState
                    title="该客户暂未生成跟进消息"
                    description="可前往跟进消息生成页基于当前客户继续生成。"
                  />
                ) : (
                  <div className="space-y-3">
                    {detail.latestFollowups.map((item) => (
                      <Card key={item.id} className="bg-[var(--color-card-bg)]">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="default">{styleLabel(item.styleType)}</Badge>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {formatDateTime(item.createdAt)}
                            </p>
                          </div>
                          <div className="rounded-md border border-[var(--color-border)] bg-white px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
                              {item.content}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <SectionHeader title="下一步操作" description="提供轻量入口，不进入复杂工作流系统。" />
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/followups?clientId=${encodeURIComponent(detail.client.id)}&displayName=${encodeURIComponent(detail.client.displayName)}`}
                  >
                    <Button variant="primary">进入跟进消息生成</Button>
                  </Link>
                  <Link
                    href={`/profiles?mode=update&clientId=${encodeURIComponent(detail.client.id)}&displayName=${encodeURIComponent(detail.client.displayName)}`}
                  >
                    <Button variant="secondary">更新客户画像</Button>
                  </Link>
                  <Link href="/clients">
                    <Button variant="ghost">返回客户列表</Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        )}
      </PageContainer>
    </main>
  );
}
