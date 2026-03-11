const SEVERITY_STYLES: Record<
  string,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  critical: {
    bg: "bg-[var(--compyl-severity-critical-bg)]",
    text: "text-[var(--compyl-severity-critical-text)]",
    border: "border-[var(--compyl-severity-critical-border)]",
    dot: "bg-[var(--compyl-severity-critical-dot)]",
    label: "Critical",
  },
  major: {
    bg: "bg-[var(--compyl-severity-major-bg)]",
    text: "text-[var(--compyl-severity-major-text)]",
    border: "border-[var(--compyl-severity-major-border)]",
    dot: "bg-[var(--compyl-severity-major-dot)]",
    label: "Major",
  },
  minor: {
    bg: "bg-[var(--compyl-severity-minor-bg)]",
    text: "text-[var(--compyl-severity-minor-text)]",
    border: "border-[var(--compyl-severity-minor-border)]",
    dot: "bg-[var(--compyl-severity-minor-dot)]",
    label: "Minor",
  },
  suggestion: {
    bg: "bg-[var(--compyl-severity-suggestion-bg)]",
    text: "text-[var(--compyl-severity-suggestion-text)]",
    border: "border-[var(--compyl-severity-suggestion-border)]",
    dot: "bg-[var(--compyl-severity-suggestion-dot)]",
    label: "Suggestion",
  },
};

const FALLBACK = {
  bg: "bg-[var(--compyl-severity-suggestion-bg)]",
  text: "text-[var(--compyl-severity-suggestion-text)]",
  border: "border-[var(--compyl-severity-suggestion-border)]",
  dot: "bg-[var(--compyl-severity-suggestion-dot)]",
  label: "Unknown",
};

export interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const key = severity.toLowerCase();
  const style = SEVERITY_STYLES[key] ?? FALLBACK;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
