export interface ConfidenceDotProps {
  /** Confidence value between 0 and 1 */
  value: number;
}

export function ConfidenceDot({ value }: ConfidenceDotProps) {
  const clamped = Math.max(0, Math.min(1, value));

  let colorClass: string;
  let ariaLabel: string;

  if (clamped >= 0.8) {
    colorClass = "bg-[var(--compyl-confidence-high)]";
    ariaLabel = "High confidence";
  } else if (clamped >= 0.5) {
    colorClass = "bg-[var(--compyl-confidence-medium)]";
    ariaLabel = "Medium confidence";
  } else {
    colorClass = "bg-[var(--compyl-confidence-low)]";
    ariaLabel = "Low confidence";
  }

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colorClass}`}
      role="img"
      aria-label={`${ariaLabel} (${Math.round(clamped * 100)}%)`}
      title={`${Math.round(clamped * 100)}% confidence`}
    />
  );
}
