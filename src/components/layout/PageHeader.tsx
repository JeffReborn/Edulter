import { type ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)] sm:text-base">
              {description}
            </p>
          )}
        </div>
        {action && <div className="mt-2 sm:mt-0">{action}</div>}
      </div>
    </div>
  );
}
