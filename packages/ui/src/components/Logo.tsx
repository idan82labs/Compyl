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
      {/* Mark: stylized "C" bracket with ember accent */}
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="8" fill="var(--compyl-accent)" />
        <path
          d="M20 10L13 16L20 22"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
