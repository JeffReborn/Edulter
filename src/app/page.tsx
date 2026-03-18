import { Card, PageContainer, PageHeader } from "@/components";

export default function Home() {
  return (
    <main className="min-h-screen">
      <PageContainer>
        <PageHeader
          title="教育咨询顾问助手 Demo"
          description="单体 Next.js 全栈项目骨架，预留知识问答、客户信息提取、跟进话术生成和轻量客户记录模块的后续开发位置。"
        />
        <Card className="max-w-2xl">
          <p className="text-sm text-[var(--color-text-muted)]">
            当前阶段为项目骨架与 UI 基座，业务页面将基于本基座逐步实现。
          </p>
        </Card>
      </PageContainer>
    </main>
  );
}
