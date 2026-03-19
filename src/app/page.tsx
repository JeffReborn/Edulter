"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  PageContainer,
  PageHeader,
  SectionHeader,
  StatusMessage,
} from "@/components";

type WorkbenchEntry = {
  key: string;
  label: string;
  description: string;
  href?: string;
  status: "available" | "unavailable";
};

const STAGE_NOTE = "Demo 阶段：当前已完成文档上传闭环，后续模块将逐步接入。";

export default function Home() {
  const router = useRouter();

  const entries = useMemo<WorkbenchEntry[]>(
    () => [
      {
        key: "documents",
        label: "文档上传",
        description: "上传内部资料并完成知识库入库处理",
        href: "/documents",
        status: "available",
      },
      {
        key: "qa",
        label: "知识问答",
        description: "基于已上传资料进行问答并查看出处",
        href: "/qa",
        status: "available",
      },
      {
        key: "profiles",
        label: "客户画像提取",
        description: "基于咨询文本提取结构化客户画像",
        status: "unavailable",
      },
      {
        key: "followups",
        label: "跟进消息生成",
        description: "基于客户上下文生成跟进消息草稿",
        status: "unavailable",
      },
      {
        key: "clients",
        label: "客户记录",
        description: "查看客户记录、画像与跟进结果",
        status: "unavailable",
      },
    ],
    []
  );

  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title="教育咨询顾问助手 Demo"
          description="Demo 工作台：从文档上传开始，逐步完成知识问答与客户工作流。"
          action={<Badge variant="default">当前阶段：Demo</Badge>}
        />

        <Card className="max-w-4xl">
          <div className="space-y-6">
            <StatusMessage variant="info" title="工作台提示">
              {STAGE_NOTE}
            </StatusMessage>

            <SectionHeader
              title="模块入口"
              description="点击进入文档上传；其余模块在后续任务卡中逐步实现。"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {entries.map((e) => {
                const isAvailable = e.status === "available";
                return (
                  <Card key={e.key} className="bg-[var(--color-card-bg)]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">
                          {e.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          {e.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        {isAvailable ? (
                          <Button
                            variant="primary"
                            onClick={() => router.push(e.href!)}
                          >
                            进入
                          </Button>
                        ) : (
                          <Button variant="secondary" disabled>
                            待实现
                          </Button>
                        )}

                        {!isAvailable && (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            当前仅预留入口
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </Card>
      </PageContainer>
    </main>
  );
}
