"use client";

import Link from "next/link";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

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

type FollowupPageState = "idle" | "loading" | "success" | "error";
type FollowupStyleType = "wechat_short" | "semi_formal" | "english_optional";

interface GeneratedFollowupItem {
  id: string;
  styleType: FollowupStyleType;
  content: string;
}

interface FollowupSuccessData {
  clientId: string;
  followups: GeneratedFollowupItem[];
}

type FollowupApiResponse =
  | { success: true; data: FollowupSuccessData }
  | { success: false; error: { code: string; message: string } };

const STYLE_OPTIONS: Array<{
  value: FollowupStyleType;
  label: string;
  hint: string;
}> = [
  {
    value: "wechat_short",
    label: "微信简短版",
    hint: "更短、更口语化，适合直接微信发送。",
  },
  {
    value: "semi_formal",
    label: "稍正式版",
    hint: "更完整、更有条理，适合稍正式跟进。",
  },
  {
    value: "english_optional",
    label: "可选英文版",
    hint: "中文为主，可在末尾附一行简短英文。",
  },
];

function styleLabel(style: FollowupStyleType): string {
  const m: Record<FollowupStyleType, string> = {
    wechat_short: "微信简短版",
    semi_formal: "稍正式版",
    english_optional: "可选英文版",
  };
  return m[style];
}

function mapBusinessError(code: string): string | null {
  if (code === "PROFILE_NOT_FOUND") {
    return "当前客户暂无可用画像，请先「新建客户画像」或从客户详情「更新客户画像」，再生成跟进消息。";
  }
  if (code === "INSUFFICIENT_CONTEXT") {
    return "当前客户上下文不足，暂无法安全生成跟进草稿。请先补充咨询文本或更新画像后重试。";
  }
  if (code === "CLIENT_NOT_FOUND") {
    return "未找到对应客户，请确认 clientId 是否正确。";
  }
  return null;
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textArea);
  if (!ok) throw new Error("COPY_FAILED");
}

function FollowupsPageInner({
  initialClientId,
  contextDisplayName,
  contextLinkInvalid,
}: {
  initialClientId: string;
  contextDisplayName: string;
  contextLinkInvalid: boolean;
}) {
  const fromClientDetail = !!initialClientId && !contextLinkInvalid;

  const [pageState, setPageState] = useState<FollowupPageState>("idle");
  const [clientId, setClientId] = useState(initialClientId);
  const [selectedStyles, setSelectedStyles] = useState<FollowupStyleType[]>([
    "wechat_short",
    "semi_formal",
  ]);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<FollowupSuccessData | null>(null);
  const [copiedFollowupId, setCopiedFollowupId] = useState<string | null>(null);

  const isLoading = pageState === "loading";

  const canSubmit = useMemo(
    () =>
      clientId.trim().length > 0 &&
      selectedStyles.length > 0 &&
      !isLoading &&
      !contextLinkInvalid,
    [clientId, selectedStyles.length, isLoading, contextLinkInvalid]
  );

  function toggleStyle(style: FollowupStyleType) {
    setSelectedStyles((prev) => {
      if (prev.includes(style)) {
        return prev.filter((x) => x !== style);
      }
      return [...prev, style];
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;

    const trimmedClientId = clientId.trim();
    if (!trimmedClientId) {
      setPageState("error");
      setErrorMessage("请先填写 clientId。");
      setResult(null);
      return;
    }
    if (selectedStyles.length === 0) {
      setPageState("error");
      setErrorMessage("请至少选择一种消息风格。");
      setResult(null);
      return;
    }

    setPageState("loading");
    setErrorMessage("");
    setResult(null);
    setCopiedFollowupId(null);

    try {
      const res = await fetch("/api/followups/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: trimmedClientId,
          styleTypes: selectedStyles,
        }),
      });

      const json = (await res.json()) as FollowupApiResponse;
      if (!json.success) {
        const friendly = mapBusinessError(json.error.code);
        setPageState("error");
        setErrorMessage(friendly ?? json.error.message ?? "跟进消息生成失败，请稍后重试。");
        return;
      }

      setPageState("success");
      setResult(json.data);
    } catch {
      setPageState("error");
      setErrorMessage("网络或服务异常，请检查后重试。");
    }
  }

  async function handleCopy(item: GeneratedFollowupItem) {
    try {
      await copyText(item.content);
      setCopiedFollowupId(item.id);
      setTimeout(() => {
        setCopiedFollowupId((prev) => (prev === item.id ? null : prev));
      }, 1500);
    } catch {
      setPageState("error");
      setErrorMessage("复制失败，请手动选中文本复制。");
    }
  }

  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title="跟进消息生成"
          description={
            contextLinkInvalid
              ? "当前链接缺少客户标识，请从客户详情页点击「进入跟进消息生成」重新进入。"
              : fromClientDetail
                ? `为「${contextDisplayName.trim() || initialClientId}」生成跟进草稿；客户 ID 已从详情页带入，可与列表中的该客户核对。`
                : "输入客户 ID 并选择风格，生成可复制的跟进消息草稿。"
          }
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
              title="生成参数"
              description="当前页面仅负责生成与复制草稿，不包含自动发送与流程自动化。对同一客户、当前有效画像再次生成时，会替换该画像下已保存的上一轮草稿（本次所选各风格一并写入，不会无限堆积历史批次）。"
            />

            {contextLinkInvalid && (
              <StatusMessage variant="error" title="无法生成跟进草稿">
                请返回客户列表，进入具体客户详情页后，再点击「进入跟进消息生成」。
              </StatusMessage>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {fromClientDetail && contextDisplayName.trim() ? (
                <div className="space-y-2">
                  <label
                    htmlFor="followups-context-display-name"
                    className="text-sm font-medium text-[var(--color-text)]"
                  >
                    客户显示名
                  </label>
                  <Input
                    id="followups-context-display-name"
                    value={contextDisplayName.trim()}
                    readOnly
                    disabled={isLoading}
                    className="bg-[var(--color-border)]/30"
                  />
                  <p className="text-xs text-[var(--color-text-muted)]">
                    显示名仅作核对；生成操作已绑定下方客户 ID，与详情页该客户一致。
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label
                  htmlFor="followups-client-id"
                  className="text-sm font-medium text-[var(--color-text)]"
                >
                  clientId（必填）
                </label>
                <Input
                  id="followups-client-id"
                  placeholder="请输入客户 ID，例如：cm9z1xxxxxxx"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={isLoading || contextLinkInvalid || fromClientDetail}
                  className={
                    fromClientDetail ? "bg-[var(--color-border)]/30" : undefined
                  }
                />
                <p className="text-xs text-[var(--color-text-muted)]">
                  {fromClientDetail
                    ? "客户 ID 已从详情页绑定；若需为其他客户生成，请从首页进入跟进消息生成或从对应客户详情重新进入。"
                    : "如遇“画像不存在”或“上下文不足”，请新建客户画像或从客户详情更新画像。"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--color-text)]">风格选择（至少一项）</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {STYLE_OPTIONS.map((opt) => {
                    const checked = selectedStyles.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`cursor-pointer rounded-md border px-4 py-3 transition-colors ${
                          checked
                            ? "border-[var(--color-primary)] bg-blue-50"
                            : "border-[var(--color-border)] bg-[var(--color-card-bg)] hover:bg-[var(--color-page-bg)]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStyle(opt.value)}
                            disabled={isLoading}
                            className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-[var(--color-text)]">{opt.label}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{opt.hint}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={!canSubmit} className="min-w-[140px]">
                  {isLoading ? "生成中…" : "生成跟进草稿"}
                </Button>
              </div>
            </form>

            <div className="border-t border-[var(--color-border)] pt-6">
              {pageState === "idle" && (
                <EmptyState
                  title="尚未生成跟进草稿"
                  description="填写 clientId 并选择风格后，系统将在这里展示可复制的跟进消息版本。"
                />
              )}

              {pageState === "loading" && <LoadingBlock message="正在生成多风格跟进消息…" />}

              {pageState === "error" && (
                <StatusMessage variant="error" title="生成失败">
                  {errorMessage}
                </StatusMessage>
              )}

              {pageState === "success" && result && (
                <div className="space-y-4">
                  <StatusMessage variant="success" title="生成完成">
                    已为
                    {contextDisplayName.trim() &&
                    result.clientId.trim() === initialClientId.trim() ? (
                      <>
                        客户「{contextDisplayName.trim()}」
                        <code className="ml-1 rounded bg-white px-1 py-0.5">
                          {result.clientId}
                        </code>
                      </>
                    ) : (
                      <>
                        客户 <code className="rounded bg-white px-1 py-0.5">{result.clientId}</code>
                      </>
                    )}{" "}
                    生成 {result.followups.length} 条可复制草稿。
                  </StatusMessage>

                  <div className="space-y-4">
                    {result.followups.map((item) => (
                      <Card key={item.id} className="bg-[var(--color-card-bg)]">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">{styleLabel(item.styleType)}</Badge>
                            </div>
                            <Button variant="ghost" onClick={() => handleCopy(item)}>
                              复制消息
                            </Button>
                          </div>

                          <div className="rounded-md border border-[var(--color-border)] bg-white px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
                              {item.content}
                            </p>
                          </div>

                          {copiedFollowupId === item.id && (
                            <p className="text-xs text-green-700">已复制到剪贴板</p>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </PageContainer>
    </main>
  );
}

function FollowupsSearchParamsBridge() {
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get("clientId")?.trim() ?? "";
  const contextDisplayName = searchParams.get("displayName")?.trim() ?? "";
  const contextLinkInvalid = !!contextDisplayName && !initialClientId;

  return (
    <FollowupsPageInner
      key={searchParams.toString()}
      initialClientId={initialClientId}
      contextDisplayName={contextDisplayName}
      contextLinkInvalid={contextLinkInvalid}
    />
  );
}

export default function FollowupsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen">
          <PageContainer>
            <LoadingBlock message="加载页面…" />
          </PageContainer>
        </main>
      }
    >
      <FollowupsSearchParamsBridge />
    </Suspense>
  );
}

