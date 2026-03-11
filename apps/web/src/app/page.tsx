import { Logo } from "@reviewlayer/ui";
import { WaitlistForm } from "./waitlist-form";

const EXECUTION_BUNDLE = `{
  "title": "Button color doesn't match design",
  "severity": "major",
  "exact_source": {
    "file_path": "src/components/Button.tsx",
    "component_name": "Button",
    "line": 42
  },
  "acceptance_criteria": [
    "Button background matches Figma spec #EA580C",
    "Hover state transitions to #DC4A04"
  ]
}`;

const STEPS = [
  {
    number: "01",
    title: "Reporter points at the problem",
    description:
      "No code knowledge needed. Click, annotate, describe.",
  },
  {
    number: "02",
    title: "Compyl resolves what they pointed at",
    description:
      "Source files, component stack, design intent \u2014 resolved automatically.",
  },
  {
    number: "03",
    title: "Developer or agent acts immediately",
    description:
      "ExecutionBundle with acceptance criteria, ready for MCP, CLI, or triage.",
  },
] as const;

const SURFACES = [
  {
    label: "MCP",
    title: "Model Context Protocol",
    description:
      "Feed ExecutionBundles directly into AI coding agents. Claude, Cursor, Copilot \u2014 any MCP-compatible tool picks up the full context.",
  },
  {
    label: "CLI",
    title: "Command line",
    description:
      "Pull bundles into your terminal workflow. Filter by severity, assign to sprints, pipe into scripts.",
  },
  {
    label: "API",
    title: "REST + WebSocket",
    description:
      "Programmatic access to every bundle, annotation, and resolution. Build custom integrations and dashboards.",
  },
] as const;

export default function Home() {
  return (
    <div style={{ backgroundColor: "var(--compyl-bg)", color: "var(--compyl-text)" }}>
      {/* ------------------------------------------------------------------ */}
      {/* Nav                                                                */}
      {/* ------------------------------------------------------------------ */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo size="md" />
        <a
          href="/login"
          className="text-sm font-medium transition-colors"
          style={{ color: "var(--compyl-text-muted)" }}
        >
          Sign in
        </a>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-24 text-center">
        {/* Alpha badge */}
        <span
          className="mb-6 inline-block rounded-full border px-3 py-1 text-xs font-medium tracking-wide"
          style={{
            borderColor: "var(--compyl-accent)",
            color: "var(--compyl-accent)",
          }}
        >
          Alpha
        </span>

        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Compile feedback into code.
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed"
          style={{ color: "var(--compyl-text-muted)" }}
        >
          Compyl turns stakeholder feedback into execution-ready context for
          developers and AI agents. Point at the problem &mdash; get a task your
          agent can run.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <a
            href="#waitlist"
            className="rounded-md bg-stone-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            Get early access
          </a>
          <a
            href="#how-it-works"
            className="rounded-md border px-6 py-3 text-sm font-medium transition-colors hover:bg-stone-100"
            style={{ borderColor: "var(--compyl-border)", color: "var(--compyl-text)" }}
          >
            See how it works
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Code preview                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div
          className="overflow-hidden rounded-lg border"
          style={{
            borderColor: "var(--compyl-border)",
            backgroundColor: "var(--compyl-surface)",
          }}
        >
          <div
            className="flex items-center gap-2 border-b px-4 py-3"
            style={{ borderColor: "var(--compyl-border)" }}
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: "#ef4444" }}
            />
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: "#f59e0b" }}
            />
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: "#22c55e" }}
            />
            <span
              className="ml-3 text-xs font-medium"
              style={{ color: "var(--compyl-text-muted)" }}
            >
              ExecutionBundle
            </span>
          </div>
          <pre className="overflow-x-auto p-6 text-sm leading-relaxed font-code">
            <code>{EXECUTION_BUNDLE}</code>
          </pre>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          How it works
        </h2>
        <div className="mt-16 grid gap-12 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number}>
              <span
                className="text-xs font-bold tracking-widest"
                style={{ color: "var(--compyl-accent)" }}
              >
                {step.number}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--compyl-text-muted)" }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Agent surfaces                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Built for agents
        </h2>
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {SURFACES.map((surface) => (
            <div
              key={surface.label}
              className="rounded-lg border p-6"
              style={{
                borderColor: "var(--compyl-border)",
                backgroundColor: "var(--compyl-surface)",
              }}
            >
              <span
                className="inline-block rounded border px-2 py-0.5 text-xs font-medium font-code"
                style={{
                  borderColor: "var(--compyl-border)",
                  color: "var(--compyl-text-muted)",
                }}
              >
                {surface.label}
              </span>
              <h3 className="mt-4 text-base font-semibold">{surface.title}</h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--compyl-text-muted)" }}
              >
                {surface.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Trust strip                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p
          className="text-center text-sm font-medium tracking-wide"
          style={{ color: "var(--compyl-text-muted)" }}
        >
          250+ tests &middot; 20 packages &middot; 41 E2E scenarios &middot; 11
          architecture docs.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Waitlist                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="waitlist"
        className="mx-auto max-w-5xl px-6 py-24"
      >
        <div
          className="rounded-lg border p-10 text-center"
          style={{
            borderColor: "var(--compyl-border)",
            backgroundColor: "var(--compyl-surface)",
          }}
        >
          <h2 className="text-2xl font-bold tracking-tight">
            Get early access
          </h2>
          <p
            className="mx-auto mt-3 max-w-md text-sm leading-relaxed"
            style={{ color: "var(--compyl-text-muted)" }}
          >
            Compyl is in closed alpha. Leave your email and we'll reach out when
            your seat is ready.
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="mx-auto flex max-w-5xl items-center justify-between border-t px-6 py-8"
        style={{ borderColor: "var(--compyl-border)" }}
      >
        <span
          className="text-xs"
          style={{ color: "var(--compyl-text-muted)" }}
        >
          &copy; 2026 Compyl
        </span>
        <a
          href="/docs"
          className="text-xs font-medium transition-colors"
          style={{ color: "var(--compyl-text-muted)" }}
        >
          Docs
        </a>
      </footer>
    </div>
  );
}
