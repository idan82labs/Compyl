export interface LogoProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show wordmark alongside the mark */
  wordmark?: boolean;
}

const SIZES = {
  sm: { mark: 20, text: "text-base", gap: "gap-1.5" },
  md: { mark: 28, text: "text-xl", gap: "gap-2" },
  lg: { mark: 36, text: "text-2xl", gap: "gap-2.5" },
} as const;

export function Logo({ size = "md", wordmark = true }: LogoProps) {
  const s = SIZES[size];

  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      {/* Mark: stacked compilation bars */}
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 20 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="11" height="2.5" rx="1.25" fill="var(--compyl-accent)" opacity="0.4" />
        <rect x="4" y="8" width="14" height="2.5" rx="1.25" fill="var(--compyl-accent)" opacity="0.65" />
        <rect x="3" y="13" width="10" height="2.5" rx="1.25" fill="var(--compyl-accent)" />
      </svg>
      {wordmark && (
        <span
          className={`font-[var(--compyl-font-display)] ${s.text} font-bold tracking-tight text-[var(--compyl-text)]`}
        >
          Comp
          <span className="text-[var(--compyl-accent)]">y</span>l
        </span>
      )}
    </span>
  );
}
