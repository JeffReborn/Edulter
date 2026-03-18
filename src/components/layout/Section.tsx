import { type HTMLAttributes } from "react";

export type SectionProps = HTMLAttributes<HTMLElement>;

export function Section({ className = "", ...props }: SectionProps) {
  return (
    <section
      className={`space-y-4 sm:space-y-5 ${className}`.trim()}
      {...props}
    />
  );
}
