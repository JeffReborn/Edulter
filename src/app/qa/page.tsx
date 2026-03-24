"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  LoadingBlock,
  PageContainer,
  PageHeader,
  SectionHeader,
  StatusMessage,
  Textarea,
} from "@/components";

type QaState = "idle" | "loading" | "success" | "error";

type Confidence = "low" | "medium" | "high";

interface Citation {
  documentId: string;
  documentTitle: string;
  snippet: string;
}

interface QaSuccessData {
  answer: string;
  citations: Citation[];
  confidence: Confidence;
}

type QaApiResponse =
  | { success: true; data: QaSuccessData }
  | { success: false; error: { code: string; message: string } };

function confidenceToBadgeVariant(
  c: Confidence
): "default" | "success" | "warning" | "error" {
  switch (c) {
    case "high":
      return "success";
    case "medium":
      return "default";
    case "low":
      return "warning";
    default:
      return "default";
  }
}

function confidenceLabel(c: Confidence): string {
  switch (c) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
      return "低";
    default:
      return c;
  }
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

export default function QaPage() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<QaState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<QaSuccessData | null>(null);
  const [answerCopied, setAnswerCopied] = useState(false);

  const isLoading = state === "loading";

  async function handleCopyAnswer(text: string) {
    try {
      await copyText(text);
      setAnswerCopied(true);
      window.setTimeout(() => {
        setAnswerCopied(false);
      }, 1500);
    } catch {
      setState("error");
      setErrorMessage("复制失败，请手动选中文本复制。");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setState("loading");
    setErrorMessage("");
    setResult(null);
    setAnswerCopied(false);

    try {
      const res = await fetch("/api/qa/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      const json = (await res.json()) as QaApiResponse;

      if (!json.success) {
        setState("error");
        setErrorMessage(json.error.message || "请求失败，请稍后重试。");
        return;
      }

      setState("success");
      setResult(json.data);
    } catch {
      setState("error");
      setErrorMessage("网络或服务异常，请检查后重试。");
    }
  }

  const noContext =
    state === "success" &&
    result &&
    result.citations.length === 0 &&
    result.confidence === "low";

  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title="知识问答"
          description="基于已上传的内部资料提问，获取带出处的标准答案。"
          action={
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md px-4 font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              返回首页
            </Link>
          }
        />

        <Card className="max-w-4xl">
          <div className="space-y-6">
            <SectionHeader
              title="输入问题"
              description="请输入您要查询的问题，系统将基于知识库检索并生成回答与出处。"
            />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="qa-question"
                  className="text-sm font-medium text-[var(--color-text)]"
                >
                  问题
                </label>
                <Textarea
                  id="qa-question"
                  placeholder="例如：加拿大高中申请一般需要准备哪些材料？"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={isLoading}
                  className="min-h-[120px]"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={!question.trim() || isLoading}
                  variant="primary"
                  className="min-w-[120px]"
                >
                  {isLoading ? "处理中…" : "提交问题"}
                </Button>
              </div>
            </form>

            <div className="border-t border-[var(--color-border)] pt-6">
              {state === "idle" && (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-8 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    输入问题并提交后，将在此处显示答案与出处。
                  </p>
                </div>
              )}

              {state === "loading" && (
                <LoadingBlock message="正在检索知识库并生成回答…" />
              )}

              {state === "error" && (
                <StatusMessage variant="error" title="问答失败">
                  {errorMessage}
                </StatusMessage>
              )}

              {state === "success" && result && (
                <div className="space-y-6">
                  {noContext && (
                    <StatusMessage variant="warning" title="未找到相关依据">
                      系统已处理您的问题，但当前知识库中未找到足够相关的资料依据，回答仅供参考。
                    </StatusMessage>
                  )}

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          回答
                        </span>
                        <Badge variant={confidenceToBadgeVariant(result.confidence)}>
                          置信度：{confidenceLabel(result.confidence)}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void handleCopyAnswer(result.answer)}
                      >
                        复制回答
                      </Button>
                    </div>

                    <div className="rounded-md border border-[var(--color-border)] bg-white px-4 py-3">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text)]">
                        {result.answer}
                      </p>
                    </div>

                    {answerCopied && (
                      <p className="text-xs text-green-700">已复制到剪贴板</p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-medium text-[var(--color-text)]">
                      出处（{result.citations.length} 条）
                    </h3>
                    {result.citations.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-muted)]">
                        本次回答未匹配到具体文档片段。
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {result.citations.map((c, i) => (
                          <li key={c.documentId + i}>
                            <Card className="bg-[var(--color-card-bg)]">
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-[var(--color-text)]">
                                  {c.documentTitle}
                                </p>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-muted)]">
                                  {c.snippet}
                                </p>
                              </div>
                            </Card>
                          </li>
                        ))}
                      </ul>
                    )}
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
