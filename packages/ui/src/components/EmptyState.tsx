import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 text-[var(--compyl-text-muted)]">{icon}</div>
      )}
      <h3 className="font-[var(--compyl-font-display)] text-lg font-semibold text-[var(--compyl-text)]">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--compyl-text-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}
