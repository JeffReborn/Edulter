export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16 text-zinc-900">
      <section className="w-full max-w-3xl space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          edulter
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          教育咨询顾问助手 Demo
        </h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-600">
          这是一个单体 Next.js 全栈项目骨架，预留了知识问答、客户信息提取、跟进话术生成和轻量客户记录模块的后续开发位置。
        </p>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          当前阶段仅初始化项目骨架，不包含任何业务接口或产品模块实现。
        </div>
      </section>
    </main>
  );
}
