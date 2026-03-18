import { type ReactNode } from "react";

export type StatusMessageVariant = "info" | "success" | "warning" | "error";

const variantStyles: Record<
  StatusMessageVariant,
  { bg: string; border: string; text: string }
> = {
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
  },
  warning: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
  },
};

export interface StatusMessageProps {
  variant: StatusMessageVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function StatusMessage({
  variant,
  title,
  children,
  className = "",
}: StatusMessageProps) {
  const s = variantStyles[variant];
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${s.bg} ${s.border} ${s.text} ${className}`.trim()}
      role="alert"
    >
      {title && <p className="font-medium">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
