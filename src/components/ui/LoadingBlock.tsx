export interface LoadingBlockProps {
  message?: string;
  className?: string;
}

export function LoadingBlock({
  message = "加载中…",
  className = "",
}: LoadingBlockProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-10 ${className}`.trim()}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="size-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"
        aria-hidden
      />
      <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
    </div>
  );
}
