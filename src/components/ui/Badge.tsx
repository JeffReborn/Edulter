import { type HTMLAttributes } from "react";

export type BadgeVariant = "default" | "success" | "warning" | "error";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-blue-50 text-blue-700",
  success: "bg-green-50 text-green-700",
  warning: "bg-orange-50 text-orange-700",
  error: "bg-red-50 text-red-700",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const badgeBase = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

export function Badge({
  className = "",
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`${badgeBase} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
