"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "h-9 min-w-[2.25rem] px-4 bg-[var(--color-primary)] text-white hover:opacity-90",
  secondary:
    "h-9 min-w-[2.25rem] px-4 bg-white border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-page-bg)]",
  ghost:
    "h-9 min-w-[2.25rem] px-4 text-[var(--color-text)] hover:bg-[var(--color-border)]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${className}`.trim()}
      {...props}
    />
  )
);

Button.displayName = "Button";

export { Button };
