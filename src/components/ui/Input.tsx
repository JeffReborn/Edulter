"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const inputBase =
  "w-full rounded-md border px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed";

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => (
    <input
      ref={ref}
      className={`${inputBase} ${
        error
          ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
          : "border-[var(--color-border)]"
      } ${className}`.trim()}
      {...props}
    />
  )
);

Input.displayName = "Input";

export { Input };
