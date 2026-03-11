import type { ReactNode } from "react";

export interface CodeBlockProps {
  children: ReactNode;
  language?: string;
}

export function CodeBlock({ children, language }: CodeBlockProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)]">
      {language && (
        <div className="border-b border-[var(--compyl-border)] bg-[var(--compyl-bg)] px-3 py-1">
          <span className="font-[var(--compyl-font-code)] text-[10px] font-medium uppercase tracking-wider text-[var(--compyl-text-muted)]">
            {language}
          </span>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="font-[var(--compyl-font-code)] text-sm leading-relaxed text-[var(--compyl-text)]">
          {children}
        </code>
      </pre>
    </div>
  );
}
