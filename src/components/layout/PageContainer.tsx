import { type HTMLAttributes } from "react";

export type PageContainerProps = HTMLAttributes<HTMLDivElement>;

export function PageContainer({ className = "", ...props }: PageContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-6xl px-6 py-6 sm:px-8 sm:py-8 ${className}`.trim()}
      {...props}
    />
  );
}
