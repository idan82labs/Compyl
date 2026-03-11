const SOURCE_STYLES: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  mcp: {
    bg: "bg-[var(--compyl-source-mcp-bg)]",
    text: "text-[var(--compyl-source-mcp-text)]",
    border: "border-[var(--compyl-source-mcp-border)]",
    label: "MCP",
  },
  cli: {
    bg: "bg-[var(--compyl-source-cli-bg)]",
    text: "text-[var(--compyl-source-cli-text)]",
    border: "border-[var(--compyl-source-cli-border)]",
    label: "CLI",
  },
  api: {
    bg: "bg-[var(--compyl-source-api-bg)]",
    text: "text-[var(--compyl-source-api-text)]",
    border: "border-[var(--compyl-source-api-border)]",
    label: "API",
  },
  ui: {
    bg: "bg-[var(--compyl-source-ui-bg)]",
    text: "text-[var(--compyl-source-ui-text)]",
    border: "border-[var(--compyl-source-ui-border)]",
    label: "UI",
  },
};

const FALLBACK = {
  bg: "bg-[var(--compyl-source-ui-bg)]",
  text: "text-[var(--compyl-source-ui-text)]",
  border: "border-[var(--compyl-source-ui-border)]",
  label: "Unknown",
};

export interface SourceBadgeProps {
  source: string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const key = source.toLowerCase();
  const style = SOURCE_STYLES[key] ?? FALLBACK;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-[var(--compyl-font-code)] text-[10px] font-medium tracking-wide ${style.bg} ${style.text} ${style.border}`}
    >
      {style.label}
    </span>
  );
}
