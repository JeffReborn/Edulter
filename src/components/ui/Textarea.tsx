"use client";

import { type TextareaHTMLAttributes, forwardRef } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const textareaBase =
  "w-full min-h-[200px] rounded-md border px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed resize-y";

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={`${textareaBase} ${
        error
          ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
          : "border-[var(--color-border)]"
      } ${className}`.trim()}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";

export { Textarea };
