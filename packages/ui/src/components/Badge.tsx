import type { ReactNode } from "react";

export interface BadgeProps {
  label: string;
  variant?: "default" | "outline";
  /** Additional CSS classes for color customization */
  color?: string;
  children?: ReactNode;
}

export function Badge({
  label,
  variant = "default",
  color,
  children,
}: BadgeProps) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors";

  const variantClasses =
    variant === "outline"
      ? "border bg-transparent"
      : "border border-transparent";

  const defaultColor =
    variant === "outline"
      ? "border-[var(--compyl-border)] text-[var(--compyl-text-muted)]"
      : "bg-[var(--compyl-accent-subtle)] text-[var(--compyl-accent)]";

  return (
    <span className={`${base} ${variantClasses} ${color ?? defaultColor}`}>
      {children}
      {label}
    </span>
  );
}
