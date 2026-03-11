import { Logo } from "@compyl/ui";
import { WaitlistForm } from "./waitlist-form";

/* Syntax-highlighted JSON — colors match a warm terminal palette */
const K = "#EA580C";  // keys: ember accent
const S = "#22C55E";  // strings: green
const N = "#FB923C";  // numbers: orange
const P = "#78716c";  // punctuation: muted stone

function J({ c, children }: { c: string; children: React.ReactNode }) {
  return <span style={{ color: c }}>{children}</span>;
}

function BundleCode() {
  return (
    <pre className="overflow-x-auto p-5 text-[13px] leading-[1.7]" style={{ color: "#e7e5e4", fontFamily: "var(--compyl-font-code)" }}>
      <code>
        <J c={P}>{"{"}</J>{"\n"}
        {"  "}<J c={K}>&quot;title&quot;</J><J c={P}>:</J> <J c={S}>&quot;Button color doesn&apos;t match design&quot;</J><J c={P}>,</J>{"\n"}
        {"  "}<J c={K}>&quot;severity&quot;</J><J c={P}>:</J> <J c={S}>&quot;major&quot;</J><J c={P}>,</J>{"\n"}
        {"  "}<J c={K}>&quot;exact_source&quot;</J><J c={P}>:</J> <J c={P}>{"{"}</J>{"\n"}
        {"    "}<J c={K}>&quot;file_path&quot;</J><J c={P}>:</J> <J c={S}>&quot;src/components/Button.tsx&quot;</J><J c={P}>,</J>{"\n"}
        {"    "}<J c={K}>&quot;component_name&quot;</J><J c={P}>:</J> <J c={S}>&quot;Button&quot;</J><J c={P}>,</J>{"\n"}
        {"    "}<J c={K}>&quot;line&quot;</J><J c={P}>:</J> <J c={N}>42</J>{"\n"}
        {"  "}<J c={P}>{"}"}</J><J c={P}>,</J>{"\n"}
        {"  "}<J c={K}>&quot;acceptance_criteria&quot;</J><J c={P}>:</J> <J c={P}>[</J>{"\n"}
        {"    "}<J c={S}>&quot;Button background matches Figma spec #EA580C&quot;</J><J c={P}>,</J>{"\n"}
        {"    "}<J c={S}>&quot;Hover state transitions to #DC4A04&quot;</J><J c={P}>,</J>{"\n"}
        {"    "}<J c={S}>&quot;Border radius matches design token (8px)&quot;</J>{"\n"}
        {"  "}<J c={P}>]</J><J c={P}>,</J>{"\n"}
        {"  "}<J c={K}>&quot;confidence&quot;</J><J c={P}>:</J> <J c={P}>{"{"}</J>{"\n"}
        {"    "}<J c={K}>&quot;component_match&quot;</J><J c={P}>:</J> <J c={N}>0.94</J><J c={P}>,</J>{"\n"}
        {"    "}<J c={K}>&quot;design_match&quot;</J><J c={P}>:</J> <J c={N}>0.87</J><J c={P}>,</J>{"\n"}
        {"    "}<J c={K}>&quot;task_clarity&quot;</J><J c={P}>:</J> <J c={N}>0.91</J>{"\n"}
        {"  "}<J c={P}>{"}"}</J>{"\n"}
        <J c={P}>{"}"}</J>
      </code>
    </pre>
  );
}

const STEPS = [
  {
    number: "01",
    title: "Point at the problem",
    description: "No code knowledge needed. Click the element, describe what's wrong in plain language.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="23" stroke="var(--compyl-accent)" strokeWidth="1.5" opacity="0.15" />
        <circle cx="24" cy="24" r="16" stroke="var(--compyl-accent)" strokeWidth="1.5" opacity="0.25" />
        <circle cx="24" cy="24" r="8" fill="var(--compyl-accent)" opacity="0.2" />
        <circle cx="24" cy="24" r="3.5" fill="var(--compyl-accent)" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Compyl resolves it",
    description: "Source file, component stack, Figma design intent, confidence scores — resolved in milliseconds.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="10" width="22" height="3.5" rx="1.75" fill="var(--compyl-accent)" opacity="0.2" />
        <rect x="10" y="18" width="28" height="3.5" rx="1.75" fill="var(--compyl-accent)" opacity="0.45" />
        <rect x="8" y="26" width="20" height="3.5" rx="1.75" fill="var(--compyl-accent)" opacity="0.7" />
        <rect x="12" y="34" width="26" height="3.5" rx="1.75" fill="var(--compyl-accent)" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Agent or dev acts",
    description: "A structured ExecutionBundle — with acceptance criteria — ready for Claude, Cursor, or your triage board.",
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="var(--compyl-accent)" strokeWidth="1.5" opacity="0.15" />
        <path d="M14 24L21 31L34 16" stroke="var(--compyl-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
] as const;

const SURFACES = [
  {
    label: "MCP",
    title: "Model Context Protocol",
    description: "Feed ExecutionBundles directly into Claude, Cursor, or any MCP-compatible agent. Full context, zero copy-paste.",
    code: "compyl://bundles/b-4f2a",
  },
  {
    label: "CLI",
    title: "Command line",
    description: "Pull bundles, filter by severity, assign to sprints. Pipe into your existing workflow.",
    code: "$ compyl pull --severity major",
  },
  {
    label: "API",
    title: "REST + WebSocket",
    description: "Programmatic access to every bundle, annotation, and resolution. Build custom integrations.",
    code: "GET /api/v1/bundles?status=pending",
  },
] as const;

const STATS = [
  { value: "<200ms", label: "Resolution time" },
  { value: "94%", label: "Match confidence" },
  { value: "Zero", label: "Code knowledge required" },
  { value: "3", label: "Agent surfaces" },
] as const;

export default function Home() {
  return (
    <div style={{ backgroundColor: "var(--compyl-bg)", color: "var(--compyl-text)" }}>
      {/* Accent top bar */}
      <div className="h-1" style={{ background: "linear-gradient(90deg, #EA580C 0%, #FB923C 50%, #EA580C 100%)" }} />

      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo size="md" />
        <div className="flex items-center gap-6">
          <a
            href="#how-it-works"
            className="hidden text-sm font-medium transition-colors sm:block"
            style={{ color: "var(--compyl-text-muted)" }}
          >
            How it works
          </a>
          <a
            href="/login"
            className="hidden text-sm font-medium transition-colors sm:block"
            style={{ color: "var(--compyl-text-muted)" }}
          >
            Sign in
          </a>
          <a
            href="#waitlist"
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
          >
            Get access
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <span
          className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide"
          style={{ borderColor: "var(--compyl-accent)", color: "var(--compyl-accent)" }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--compyl-accent)" }} />
          Now in alpha
        </span>

        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
          Compile feedback
          <br />
          into code.
        </h1>

        <p
          className="mx-auto mt-6 max-w-lg text-base leading-relaxed sm:text-lg"
          style={{ color: "var(--compyl-text-muted)" }}
        >
          Stakeholders point at what&apos;s wrong. Compyl packages the fix context
          — source, design intent, acceptance criteria — for your AI agent or developer.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <a
            href="#waitlist"
            className="w-full rounded-lg bg-stone-900 px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-stone-800 sm:w-auto"
          >
            Get early access
          </a>
          <a
            href="#how-it-works"
            className="w-full rounded-lg border px-8 py-3.5 text-sm font-semibold transition-colors hover:bg-stone-100 sm:w-auto"
            style={{ borderColor: "var(--compyl-border)", color: "var(--compyl-text)" }}
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Code preview */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--compyl-accent)" }}>
          The output
        </p>
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--compyl-border)", backgroundColor: "#1c1917", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(234,88,12,0.05)" }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: "#292524" }}>
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#ef4444" }} />
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#22c55e" }} />
            <span className="ml-3 text-xs font-medium" style={{ color: "#a8a29e" }}>
              execution-bundle.json
            </span>
          </div>
          <BundleCode />
        </div>
        <p className="mt-5 text-center text-sm" style={{ color: "var(--compyl-text-muted)" }}>
          Every piece of feedback becomes a structured <span style={{ color: "var(--compyl-text)", fontWeight: 600 }}>ExecutionBundle</span> — not a screenshot in Slack.
        </p>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-t border-b py-24"
        style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-surface)" }}
      >
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--compyl-accent)" }}>
            How it works
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Feedback to action in three steps
          </h2>

          <div className="mt-16 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step) => (
              <div key={step.number} className="rounded-xl border p-6 text-center sm:text-left" style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-bg)" }}>
                <div className="mb-4 flex justify-center sm:justify-start">
                  {step.icon}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--compyl-accent)" }}>
                  Step {step.number}
                </p>
                <h3 className="mt-2 text-lg font-semibold leading-snug">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--compyl-text-muted)" }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent surfaces */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-center text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--compyl-accent)" }}>
          Integrations
        </p>
        <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Built for the age of AI agents
        </h2>
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {SURFACES.map((surface) => (
            <div
              key={surface.label}
              className="flex flex-col rounded-xl border p-6"
              style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-surface)" }}
            >
              <span
                className="inline-block w-fit rounded-md border px-2.5 py-1 text-xs font-bold tracking-wider"
                style={{
                  borderColor: "var(--compyl-accent)",
                  color: "var(--compyl-accent)",
                  fontFamily: "var(--compyl-font-code)",
                }}
              >
                {surface.label}
              </span>
              <h3 className="mt-4 text-base font-semibold">{surface.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: "var(--compyl-text-muted)" }}>
                {surface.description}
              </p>
              <div
                className="mt-5 rounded-lg px-4 py-2.5 text-[13px]"
                style={{ backgroundColor: "#1c1917", color: "#d6d3d1", fontFamily: "var(--compyl-font-code)" }}
              >
                {surface.code}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section
        className="border-t border-b py-16"
        style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-surface)" }}
      >
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 px-6 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold" style={{ color: "var(--compyl-accent)" }}>{stat.value}</div>
              <div className="mt-1 text-xs font-medium tracking-wide" style={{ color: "var(--compyl-text-muted)" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="mx-auto max-w-5xl px-6 py-24">
        <div
          className="rounded-2xl border p-8 text-center sm:p-14"
          style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-surface)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--compyl-accent)" }}>
            Limited alpha
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Ship feedback that writes itself
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed" style={{ color: "var(--compyl-text-muted)" }}>
            Join the closed alpha. We&apos;ll reach out when your seat is ready.
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mx-auto flex max-w-5xl items-center justify-between border-t px-6 py-8"
        style={{ borderColor: "var(--compyl-border)" }}
      >
        <Logo size="sm" wordmark={false} />
        <div className="flex items-center gap-6">
          <a href="https://github.com/idan82labs/Compyl" className="text-xs font-medium transition-colors" style={{ color: "var(--compyl-text-muted)" }}>
            GitHub
          </a>
          <span className="text-xs" style={{ color: "var(--compyl-text-muted)" }}>
            &copy; 2026 Compyl
          </span>
        </div>
      </footer>
    </div>
  );
}
