import { type HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement>;

const cardBase =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 sm:p-5";

export function Card({ className = "", ...props }: CardProps) {
  return <div className={`${cardBase} ${className}`.trim()} {...props} />;
}
