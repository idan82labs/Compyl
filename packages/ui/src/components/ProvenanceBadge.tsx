const MODE_STYLES: Record<
  string,
  { icon: string; label: string; className: string }
> = {
  exact: {
    icon: "\u2022",
    label: "Exact",
    className:
      "bg-[var(--compyl-status-success-bg)] text-[var(--compyl-status-success-text)] border-[var(--compyl-status-success-border)]",
  },
  ancestry: {
    icon: "\u2191",
    label: "Ancestry",
    className:
      "bg-[var(--compyl-status-in-progress-bg)] text-[var(--compyl-status-in-progress-text)] border-[var(--compyl-status-in-progress-border)]",
  },
  heuristic: {
    icon: "~",
    label: "Heuristic",
    className:
      "bg-[var(--compyl-status-warning-bg)] text-[var(--compyl-status-warning-text)] border-[var(--compyl-status-warning-border)]",
  },
  manual: {
    icon: "\u270E",
    label: "Manual",
    className:
      "bg-[var(--compyl-status-info-bg)] text-[var(--compyl-status-info-text)] border-[var(--compyl-status-info-border)]",
  },
  fallback: {
    icon: "?",
    label: "Fallback",
    className:
      "bg-[var(--compyl-status-pending-bg)] text-[var(--compyl-status-pending-text)] border-[var(--compyl-status-pending-border)]",
  },
};

const DEFAULT_STYLE = {
  icon: "\u2022",
  label: "Unknown",
  className:
    "bg-[var(--compyl-status-info-bg)] text-[var(--compyl-status-info-text)] border-[var(--compyl-status-info-border)]",
};

export interface ProvenanceBadgeProps {
  mode: string;
  label?: string;
}

export function ProvenanceBadge({ mode, label }: ProvenanceBadgeProps) {
  const key = mode.toLowerCase();
  const style = MODE_STYLES[key] ?? DEFAULT_STYLE;
  const displayLabel = label ?? style.label;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium tracking-wide ${style.className}`}
    >
      <span className="text-xs leading-none">{style.icon}</span>
      {displayLabel}
    </span>
  );
}
