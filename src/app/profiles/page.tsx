"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

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
  Textarea,
} from "@/components";

type PageState = "idle" | "loading" | "success" | "error";

type ClientStage =
  | "new_lead"
  | "initial_consultation"
  | "in_followup"
  | "high_intent"
  | "uncertain"
  | "closed";

interface ExtractedClient {
  id: string;
  displayName: string;
  currentStage: ClientStage;
  updatedAt: string;
}

interface ExtractedConversationRecord {
  id: string;
  createdAt: string;
}

interface ExtractedProfile {
  id: string;
  studentStage: string;
  targetCountry: string;
  targetProgram: string;
  budgetRange: string;
  timeline: string;
  englishLevel: string;
  parentGoals: string[];
  mainConcerns: string[];
  riskFlags: string[];
  currentStage: ClientStage;
  structuredJson: Record<string, unknown>;
}

interface ProfileExtractSuccessData {
  client: ExtractedClient;
  conversationRecord: ExtractedConversationRecord;
  profile: ExtractedProfile;
}

type ProfileExtractApiResponse =
  | { success: true; data: ProfileExtractSuccessData }
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

function FieldRow({ label, value }: { label: string; value: string }) {
  const v = value?.trim() ? value.trim() : "—";
  return (
    <div>
      <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text)]">{v}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  const cleaned = (items ?? []).map((s) => s.trim()).filter(Boolean);
  return (
    <div>
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      {cleaned.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">—</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {cleaned.map((x, idx) => (
            <li key={`${x}-${idx}`} className="text-sm text-[var(--color-text)]">
              - {x}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProfilesPage() {
  const [state, setState] = useState<PageState>("idle");
  const [clientDisplayName, setClientDisplayName] = useState("");
  const [conversationText, setConversationText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<ProfileExtractSuccessData | null>(null);

  const isLoading = state === "loading";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;

    const trimmedText = conversationText.trim();
    if (!trimmedText) {
      setState("error");
      setErrorMessage("请先粘贴咨询文本后再提取画像。");
      setResult(null);
      return;
    }

    setState("loading");
    setErrorMessage("");
    setResult(null);

    const name = clientDisplayName.trim();

    try {
      const res = await fetch("/api/profiles/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationText: trimmedText,
          ...(name ? { clientDisplayName: name } : {}),
        }),
      });

      const json = (await res.json()) as ProfileExtractApiResponse;

      if (!json.success) {
        setState("error");
        setErrorMessage(json.error.message || "提取失败，请稍后重试。");
        return;
      }

      setState("success");
      setResult(json.data);
    } catch {
      setState("error");
      setErrorMessage("网络或服务异常，请检查后重试。");
    }
  }

  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title="客户画像提取"
          description="粘贴咨询文本，系统将提取结构化客户画像，并写入客户记录。"
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
              title="输入咨询文本"
              description="建议粘贴完整首咨聊天记录或顾问整理纪要；信息不足时系统会保守输出。"
            />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="profiles-client-display-name"
                    className="text-sm font-medium text-[var(--color-text)]"
                  >
                    客户显示名（可选）
                  </label>
                  <Input
                    id="profiles-client-display-name"
                    placeholder="例如：王女士 / 李同学家长"
                    value={clientDisplayName}
                    onChange={(e) => setClientDisplayName(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    若填写，将按显示名精确匹配复用已有客户；不填则默认新建客户。
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="profiles-conversation-text"
                  className="text-sm font-medium text-[var(--color-text)]"
                >
                  咨询文本（必填）
                </label>
                <Textarea
                  id="profiles-conversation-text"
                  placeholder="粘贴聊天记录/咨询纪要……"
                  value={conversationText}
                  onChange={(e) => setConversationText(e.target.value)}
                  disabled={isLoading}
                  className="min-h-[220px]"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={!conversationText.trim() || isLoading}
                  variant="primary"
                  className="min-w-[140px]"
                >
                  {isLoading ? "提取中…" : "提取画像"}
                </Button>
              </div>
            </form>

            <div className="border-t border-[var(--color-border)] pt-6">
              {state === "idle" && (
                <EmptyState
                  title="尚未生成画像"
                  description="提交咨询文本后，将在此处展示客户、咨询记录与画像结果。"
                />
              )}

              {state === "loading" && <LoadingBlock message="正在提取客户画像并保存结果…" />}

              {state === "error" && (
                <StatusMessage variant="error" title="画像提取失败">
                  {errorMessage}
                </StatusMessage>
              )}

              {state === "success" && result && (
                <div className="space-y-6">
                  <StatusMessage variant="success" title="画像提取完成">
                    已生成结构化画像，并完成客户记录写入。
                  </StatusMessage>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="bg-[var(--color-card-bg)] lg:col-span-1">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-[var(--color-text)]">
                            客户
                          </p>
                          <Badge variant={stageBadgeVariant(result.client.currentStage)}>
                            {stageLabel(result.client.currentStage)}
                          </Badge>
                        </div>

                        <FieldRow label="显示名" value={result.client.displayName} />
                        <FieldRow label="更新时间" value={formatDateTime(result.client.updatedAt)} />
                        <FieldRow label="客户 ID" value={result.client.id} />
                      </div>
                    </Card>

                    <Card className="bg-[var(--color-card-bg)] lg:col-span-2">
                      <div className="space-y-4">
                        <p className="text-sm font-medium text-[var(--color-text)]">
                          本次咨询记录
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FieldRow label="创建时间" value={formatDateTime(result.conversationRecord.createdAt)} />
                          <FieldRow label="记录 ID" value={result.conversationRecord.id} />
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          来源：文本输入
                        </p>
                      </div>
                    </Card>
                  </div>

                  <Card className="bg-[var(--color-card-bg)]">
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text)]">
                            客户画像
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                            以结构化字段展示关键摘要，用于后续跟进与回看。
                          </p>
                        </div>
                        <Badge variant={stageBadgeVariant(result.profile.currentStage)}>
                          阶段：{stageLabel(result.profile.currentStage)}
                        </Badge>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <FieldRow label="学生阶段" value={result.profile.studentStage} />
                        <FieldRow label="目标国家" value={result.profile.targetCountry} />
                        <FieldRow label="目标项目" value={result.profile.targetProgram} />
                        <FieldRow label="预算范围" value={result.profile.budgetRange} />
                        <FieldRow label="时间线" value={result.profile.timeline} />
                        <FieldRow label="语言基础" value={result.profile.englishLevel} />
                      </div>

                      <div className="grid gap-6 lg:grid-cols-3">
                        <ListBlock title="家长/客户目标" items={result.profile.parentGoals} />
                        <ListBlock title="主要关注点" items={result.profile.mainConcerns} />
                        <ListBlock title="风险点" items={result.profile.riskFlags} />
                      </div>

                      <p className="text-xs text-[var(--color-text-muted)]">
                        画像 ID：{result.profile.id}
                      </p>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </Card>
      </PageContainer>
    </main>
  );
}

