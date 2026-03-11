// Compyl Ember Design System — Token Definitions
// All color values are defined here as the single source of truth.
// Consumed by components via Tailwind classes referencing CSS custom properties.

// ---------------------------------------------------------------------------
// Stone scale (warm neutral palette — Tailwind stone values)
// ---------------------------------------------------------------------------

export const stone = {
  50: "#fafaf9",
  100: "#f5f5f4",
  200: "#e7e5e4",
  300: "#d6d3d1",
  400: "#a8a29e",
  500: "#78716c",
  600: "#57534e",
  700: "#44403c",
  800: "#292524",
  900: "#1c1917",
  950: "#0c0a09",
} as const;

// ---------------------------------------------------------------------------
// Ember accent scale
// ---------------------------------------------------------------------------

export const ember = {
  DEFAULT: "#EA580C",
  hover: "#DC4A04",
  subtle: "rgba(234,88,12,0.06)",
  50: "#FFF7ED",
  100: "#FFEDD5",
  200: "#FED7AA",
  300: "#FDBA74",
  400: "#FB923C",
  500: "#F97316",
  600: "#EA580C",
  700: "#C2410C",
  800: "#9A3412",
  900: "#7C2D12",
} as const;

// ---------------------------------------------------------------------------
// Dark mode palette
// ---------------------------------------------------------------------------

export const dark = {
  bg: "#0C0A09",
  surface: "#171412",
  border: "#292524",
  accent: "#FB923C",
  text: "#fafaf9",
  textMuted: "#a8a29e",
} as const;

// ---------------------------------------------------------------------------
// Light mode palette
// ---------------------------------------------------------------------------

export const light = {
  bg: "#fafaf9",
  surface: "#FFFFFF",
  border: "#e7e5e4",
  accent: "#EA580C",
  text: "#1c1917",
  textMuted: "#78716c",
} as const;

// ---------------------------------------------------------------------------
// Status semantic colors (warm palette — no cold blue/purple)
// ---------------------------------------------------------------------------

export const status = {
  pending: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    dot: "#F59E0B",
  },
  approved: {
    bg: "#ECFDF5",
    text: "#065F46",
    border: "#A7F3D0",
    dot: "#10B981",
  },
  in_progress: {
    bg: "#FFF7ED",
    text: "#9A3412",
    border: "#FED7AA",
    dot: "#F97316",
  },
  resolved: {
    bg: "#F0FDF4",
    text: "#166534",
    border: "#BBF7D0",
    dot: "#22C55E",
  },
  rejected: {
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "#FECACA",
    dot: "#EF4444",
  },
  error: {
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "#FECACA",
    dot: "#EF4444",
  },
  success: {
    bg: "#F0FDF4",
    text: "#166534",
    border: "#BBF7D0",
    dot: "#22C55E",
  },
  warning: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    dot: "#F59E0B",
  },
  info: {
    bg: "#fafaf9",
    text: "#44403c",
    border: "#d6d3d1",
    dot: "#78716c",
  },
} as const;

// ---------------------------------------------------------------------------
// Source colors (activity origin)
// ---------------------------------------------------------------------------

export const source = {
  mcp: {
    bg: "#FFF7ED",
    text: "#9A3412",
    border: "#FDBA74",
    dot: "#EA580C",
  },
  cli: {
    bg: "#ECFDF5",
    text: "#065F46",
    border: "#A7F3D0",
    dot: "#10B981",
  },
  api: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    dot: "#F59E0B",
  },
  ui: {
    bg: "#fafaf9",
    text: "#44403c",
    border: "#d6d3d1",
    dot: "#78716c",
  },
} as const;

// ---------------------------------------------------------------------------
// Severity colors
// ---------------------------------------------------------------------------

export const severity = {
  critical: {
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "#FECACA",
    dot: "#EF4444",
  },
  major: {
    bg: "#FFF7ED",
    text: "#9A3412",
    border: "#FED7AA",
    dot: "#EA580C",
  },
  minor: {
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    dot: "#F59E0B",
  },
  suggestion: {
    bg: "#fafaf9",
    text: "#44403c",
    border: "#d6d3d1",
    dot: "#78716c",
  },
} as const;

// ---------------------------------------------------------------------------
// Confidence thresholds (for ConfidenceDot)
// ---------------------------------------------------------------------------

export const confidence = {
  high: { min: 0.8, color: "#22C55E" },
  medium: { min: 0.5, color: "#F59E0B" },
  low: { min: 0, color: "#EF4444" },
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  display: "'DM Sans', sans-serif",
  code: "'JetBrains Mono', monospace",
} as const;

// ---------------------------------------------------------------------------
// Flat CSS variable map — used to generate :root and .dark custom properties
// ---------------------------------------------------------------------------

export const cssVariables = {
  light: {
    "--compyl-bg": light.bg,
    "--compyl-surface": light.surface,
    "--compyl-border": light.border,
    "--compyl-accent": light.accent,
    "--compyl-accent-hover": ember.hover,
    "--compyl-accent-subtle": ember.subtle,
    "--compyl-text": light.text,
    "--compyl-text-muted": light.textMuted,
    "--compyl-font-display": typography.display,
    "--compyl-font-code": typography.code,

    // Status
    "--compyl-status-pending-bg": status.pending.bg,
    "--compyl-status-pending-text": status.pending.text,
    "--compyl-status-pending-border": status.pending.border,
    "--compyl-status-pending-dot": status.pending.dot,

    "--compyl-status-approved-bg": status.approved.bg,
    "--compyl-status-approved-text": status.approved.text,
    "--compyl-status-approved-border": status.approved.border,
    "--compyl-status-approved-dot": status.approved.dot,

    "--compyl-status-in-progress-bg": status.in_progress.bg,
    "--compyl-status-in-progress-text": status.in_progress.text,
    "--compyl-status-in-progress-border": status.in_progress.border,
    "--compyl-status-in-progress-dot": status.in_progress.dot,

    "--compyl-status-resolved-bg": status.resolved.bg,
    "--compyl-status-resolved-text": status.resolved.text,
    "--compyl-status-resolved-border": status.resolved.border,
    "--compyl-status-resolved-dot": status.resolved.dot,

    "--compyl-status-rejected-bg": status.rejected.bg,
    "--compyl-status-rejected-text": status.rejected.text,
    "--compyl-status-rejected-border": status.rejected.border,
    "--compyl-status-rejected-dot": status.rejected.dot,

    "--compyl-status-error-bg": status.error.bg,
    "--compyl-status-error-text": status.error.text,
    "--compyl-status-error-border": status.error.border,
    "--compyl-status-error-dot": status.error.dot,

    "--compyl-status-success-bg": status.success.bg,
    "--compyl-status-success-text": status.success.text,
    "--compyl-status-success-border": status.success.border,
    "--compyl-status-success-dot": status.success.dot,

    "--compyl-status-warning-bg": status.warning.bg,
    "--compyl-status-warning-text": status.warning.text,
    "--compyl-status-warning-border": status.warning.border,
    "--compyl-status-warning-dot": status.warning.dot,

    "--compyl-status-info-bg": status.info.bg,
    "--compyl-status-info-text": status.info.text,
    "--compyl-status-info-border": status.info.border,
    "--compyl-status-info-dot": status.info.dot,

    // Source
    "--compyl-source-mcp-bg": source.mcp.bg,
    "--compyl-source-mcp-text": source.mcp.text,
    "--compyl-source-mcp-border": source.mcp.border,
    "--compyl-source-mcp-dot": source.mcp.dot,

    "--compyl-source-cli-bg": source.cli.bg,
    "--compyl-source-cli-text": source.cli.text,
    "--compyl-source-cli-border": source.cli.border,
    "--compyl-source-cli-dot": source.cli.dot,

    "--compyl-source-api-bg": source.api.bg,
    "--compyl-source-api-text": source.api.text,
    "--compyl-source-api-border": source.api.border,
    "--compyl-source-api-dot": source.api.dot,

    "--compyl-source-ui-bg": source.ui.bg,
    "--compyl-source-ui-text": source.ui.text,
    "--compyl-source-ui-border": source.ui.border,
    "--compyl-source-ui-dot": source.ui.dot,

    // Severity
    "--compyl-severity-critical-bg": severity.critical.bg,
    "--compyl-severity-critical-text": severity.critical.text,
    "--compyl-severity-critical-border": severity.critical.border,
    "--compyl-severity-critical-dot": severity.critical.dot,

    "--compyl-severity-major-bg": severity.major.bg,
    "--compyl-severity-major-text": severity.major.text,
    "--compyl-severity-major-border": severity.major.border,
    "--compyl-severity-major-dot": severity.major.dot,

    "--compyl-severity-minor-bg": severity.minor.bg,
    "--compyl-severity-minor-text": severity.minor.text,
    "--compyl-severity-minor-border": severity.minor.border,
    "--compyl-severity-minor-dot": severity.minor.dot,

    "--compyl-severity-suggestion-bg": severity.suggestion.bg,
    "--compyl-severity-suggestion-text": severity.suggestion.text,
    "--compyl-severity-suggestion-border": severity.suggestion.border,
    "--compyl-severity-suggestion-dot": severity.suggestion.dot,

    // Confidence
    "--compyl-confidence-high": confidence.high.color,
    "--compyl-confidence-medium": confidence.medium.color,
    "--compyl-confidence-low": confidence.low.color,
  },
  dark: {
    "--compyl-bg": dark.bg,
    "--compyl-surface": dark.surface,
    "--compyl-border": dark.border,
    "--compyl-accent": dark.accent,
    "--compyl-accent-hover": "#F97316",
    "--compyl-accent-subtle": "rgba(251,146,60,0.08)",
    "--compyl-text": dark.text,
    "--compyl-text-muted": dark.textMuted,
    "--compyl-font-display": typography.display,
    "--compyl-font-code": typography.code,

    // Status (dark mode — deeper backgrounds, brighter text)
    "--compyl-status-pending-bg": "rgba(245,158,11,0.10)",
    "--compyl-status-pending-text": "#FCD34D",
    "--compyl-status-pending-border": "rgba(245,158,11,0.20)",
    "--compyl-status-pending-dot": "#F59E0B",

    "--compyl-status-approved-bg": "rgba(16,185,129,0.10)",
    "--compyl-status-approved-text": "#6EE7B7",
    "--compyl-status-approved-border": "rgba(16,185,129,0.20)",
    "--compyl-status-approved-dot": "#10B981",

    "--compyl-status-in-progress-bg": "rgba(249,115,22,0.10)",
    "--compyl-status-in-progress-text": "#FDBA74",
    "--compyl-status-in-progress-border": "rgba(249,115,22,0.20)",
    "--compyl-status-in-progress-dot": "#F97316",

    "--compyl-status-resolved-bg": "rgba(34,197,94,0.10)",
    "--compyl-status-resolved-text": "#86EFAC",
    "--compyl-status-resolved-border": "rgba(34,197,94,0.20)",
    "--compyl-status-resolved-dot": "#22C55E",

    "--compyl-status-rejected-bg": "rgba(239,68,68,0.10)",
    "--compyl-status-rejected-text": "#FCA5A5",
    "--compyl-status-rejected-border": "rgba(239,68,68,0.20)",
    "--compyl-status-rejected-dot": "#EF4444",

    "--compyl-status-error-bg": "rgba(239,68,68,0.10)",
    "--compyl-status-error-text": "#FCA5A5",
    "--compyl-status-error-border": "rgba(239,68,68,0.20)",
    "--compyl-status-error-dot": "#EF4444",

    "--compyl-status-success-bg": "rgba(34,197,94,0.10)",
    "--compyl-status-success-text": "#86EFAC",
    "--compyl-status-success-border": "rgba(34,197,94,0.20)",
    "--compyl-status-success-dot": "#22C55E",

    "--compyl-status-warning-bg": "rgba(245,158,11,0.10)",
    "--compyl-status-warning-text": "#FCD34D",
    "--compyl-status-warning-border": "rgba(245,158,11,0.20)",
    "--compyl-status-warning-dot": "#F59E0B",

    "--compyl-status-info-bg": "rgba(168,162,158,0.10)",
    "--compyl-status-info-text": "#d6d3d1",
    "--compyl-status-info-border": "rgba(168,162,158,0.20)",
    "--compyl-status-info-dot": "#78716c",

    // Source (dark mode)
    "--compyl-source-mcp-bg": "rgba(234,88,12,0.10)",
    "--compyl-source-mcp-text": "#FDBA74",
    "--compyl-source-mcp-border": "rgba(234,88,12,0.20)",
    "--compyl-source-mcp-dot": "#EA580C",

    "--compyl-source-cli-bg": "rgba(16,185,129,0.10)",
    "--compyl-source-cli-text": "#6EE7B7",
    "--compyl-source-cli-border": "rgba(16,185,129,0.20)",
    "--compyl-source-cli-dot": "#10B981",

    "--compyl-source-api-bg": "rgba(245,158,11,0.10)",
    "--compyl-source-api-text": "#FCD34D",
    "--compyl-source-api-border": "rgba(245,158,11,0.20)",
    "--compyl-source-api-dot": "#F59E0B",

    "--compyl-source-ui-bg": "rgba(168,162,158,0.10)",
    "--compyl-source-ui-text": "#d6d3d1",
    "--compyl-source-ui-border": "rgba(168,162,158,0.20)",
    "--compyl-source-ui-dot": "#78716c",

    // Severity (dark mode)
    "--compyl-severity-critical-bg": "rgba(239,68,68,0.10)",
    "--compyl-severity-critical-text": "#FCA5A5",
    "--compyl-severity-critical-border": "rgba(239,68,68,0.20)",
    "--compyl-severity-critical-dot": "#EF4444",

    "--compyl-severity-major-bg": "rgba(234,88,12,0.10)",
    "--compyl-severity-major-text": "#FDBA74",
    "--compyl-severity-major-border": "rgba(234,88,12,0.20)",
    "--compyl-severity-major-dot": "#EA580C",

    "--compyl-severity-minor-bg": "rgba(245,158,11,0.10)",
    "--compyl-severity-minor-text": "#FCD34D",
    "--compyl-severity-minor-border": "rgba(245,158,11,0.20)",
    "--compyl-severity-minor-dot": "#F59E0B",

    "--compyl-severity-suggestion-bg": "rgba(168,162,158,0.10)",
    "--compyl-severity-suggestion-text": "#d6d3d1",
    "--compyl-severity-suggestion-border": "rgba(168,162,158,0.20)",
    "--compyl-severity-suggestion-dot": "#78716c",

    // Confidence
    "--compyl-confidence-high": confidence.high.color,
    "--compyl-confidence-medium": confidence.medium.color,
    "--compyl-confidence-low": confidence.low.color,
  },
} as const;

// ---------------------------------------------------------------------------
// Re-export everything as a single tokens object for convenience
// ---------------------------------------------------------------------------

export const tokens = {
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
} as const;
