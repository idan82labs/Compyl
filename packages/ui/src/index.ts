// @compyl/ui — Compyl Ember Design System
// Shared tokens, primitives, and components.
// Does NOT import from @compyl/contracts — all components take primitive props.

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

export {
  stone,
  ember,
  dark,
  light,
  status,
  source,
  severity,
  confidence,
  typography,
  cssVariables,
  tokens,
} from "./tokens.js";

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export { Badge } from "./components/Badge.js";
export type { BadgeProps } from "./components/Badge.js";

export { StatusBadge } from "./components/StatusBadge.js";
export type { StatusBadgeProps } from "./components/StatusBadge.js";

export { SeverityBadge } from "./components/SeverityBadge.js";
export type { SeverityBadgeProps } from "./components/SeverityBadge.js";

export { SourceBadge } from "./components/SourceBadge.js";
export type { SourceBadgeProps } from "./components/SourceBadge.js";

export { ConfidenceDot } from "./components/ConfidenceDot.js";
export type { ConfidenceDotProps } from "./components/ConfidenceDot.js";

export { ProvenanceBadge } from "./components/ProvenanceBadge.js";
export type { ProvenanceBadgeProps } from "./components/ProvenanceBadge.js";

export { EmptyState } from "./components/EmptyState.js";
export type { EmptyStateProps } from "./components/EmptyState.js";

export { LoadingState } from "./components/LoadingState.js";
export type { LoadingStateProps } from "./components/LoadingState.js";

export { ErrorState } from "./components/ErrorState.js";
export type { ErrorStateProps } from "./components/ErrorState.js";

export { CodeBlock } from "./components/CodeBlock.js";
export type { CodeBlockProps } from "./components/CodeBlock.js";

export { Logo } from "./components/Logo.js";
export type { LogoProps } from "./components/Logo.js";
