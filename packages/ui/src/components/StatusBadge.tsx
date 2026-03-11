const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  pending: {
    bg: "bg-[var(--compyl-status-pending-bg)]",
    text: "text-[var(--compyl-status-pending-text)]",
    border: "border-[var(--compyl-status-pending-border)]",
    dot: "bg-[var(--compyl-status-pending-dot)]",
    label: "Pending",
  },
  approved: {
    bg: "bg-[var(--compyl-status-approved-bg)]",
    text: "text-[var(--compyl-status-approved-text)]",
    border: "border-[var(--compyl-status-approved-border)]",
    dot: "bg-[var(--compyl-status-approved-dot)]",
    label: "Approved",
  },
  in_progress: {
    bg: "bg-[var(--compyl-status-in-progress-bg)]",
    text: "text-[var(--compyl-status-in-progress-text)]",
    border: "border-[var(--compyl-status-in-progress-border)]",
    dot: "bg-[var(--compyl-status-in-progress-dot)]",
    label: "In Progress",
  },
  resolved: {
    bg: "bg-[var(--compyl-status-resolved-bg)]",
    text: "text-[var(--compyl-status-resolved-text)]",
    border: "border-[var(--compyl-status-resolved-border)]",
    dot: "bg-[var(--compyl-status-resolved-dot)]",
    label: "Resolved",
  },
  rejected: {
    bg: "bg-[var(--compyl-status-rejected-bg)]",
    text: "text-[var(--compyl-status-rejected-text)]",
    border: "border-[var(--compyl-status-rejected-border)]",
    dot: "bg-[var(--compyl-status-rejected-dot)]",
    label: "Rejected",
  },
  error: {
    bg: "bg-[var(--compyl-status-error-bg)]",
    text: "text-[var(--compyl-status-error-text)]",
    border: "border-[var(--compyl-status-error-border)]",
    dot: "bg-[var(--compyl-status-error-dot)]",
    label: "Error",
  },
  success: {
    bg: "bg-[var(--compyl-status-success-bg)]",
    text: "text-[var(--compyl-status-success-text)]",
    border: "border-[var(--compyl-status-success-border)]",
    dot: "bg-[var(--compyl-status-success-dot)]",
    label: "Success",
  },
  warning: {
    bg: "bg-[var(--compyl-status-warning-bg)]",
    text: "text-[var(--compyl-status-warning-text)]",
    border: "border-[var(--compyl-status-warning-border)]",
    dot: "bg-[var(--compyl-status-warning-dot)]",
    label: "Warning",
  },
  info: {
    bg: "bg-[var(--compyl-status-info-bg)]",
    text: "text-[var(--compyl-status-info-text)]",
    border: "border-[var(--compyl-status-info-border)]",
    dot: "bg-[var(--compyl-status-info-dot)]",
    label: "Info",
  },
};

const FALLBACK = {
  bg: "bg-[var(--compyl-status-info-bg)]",
  text: "text-[var(--compyl-status-info-text)]",
  border: "border-[var(--compyl-status-info-border)]",
  dot: "bg-[var(--compyl-status-info-dot)]",
  label: "Unknown",
};

export interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const key = status.toLowerCase().replace(/[\s-]/g, "_");
  const style = STATUS_STYLES[key] ?? FALLBACK;
  const displayLabel = label ?? style.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {displayLabel}
    </span>
  );
}
