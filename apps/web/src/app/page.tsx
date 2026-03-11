import { Logo } from "@compyl/ui";
import { WaitlistForm } from "./waitlist-form";

/* ── The "Before" — a Slack-style messy thread ── */
function SlackThread() {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-xl border p-4 text-[13px] leading-relaxed"
      style={{ backgroundColor: "#1a1523", borderColor: "#3d1f1f", color: "#c4b5ce", boxShadow: "inset 0 0 40px rgba(220,38,38,0.04)" }}
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#7c6f8a" }}>
        <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: "#7c6f8a" }} />
        #design-review
      </div>

      <div className="flex gap-2">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded" style={{ backgroundColor: "#6d5dfc" }} />
        <div>
          <span className="text-[11px] font-semibold" style={{ color: "#e2d8ec" }}>Sarah</span>
          <span className="ml-1.5 text-[10px]" style={{ color: "#5c5068" }}>2:34 PM</span>
          <p className="mt-0.5">this button looks wrong, the color is off</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded" style={{ backgroundColor: "#2da563" }} />
        <div>
          <span className="text-[11px] font-semibold" style={{ color: "#e2d8ec" }}>Tim</span>
          <span className="ml-1.5 text-[10px]" style={{ color: "#5c5068" }}>2:41 PM</span>
          <p className="mt-0.5">which button?</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded" style={{ backgroundColor: "#6d5dfc" }} />
        <div>
          <span className="text-[11px] font-semibold" style={{ color: "#e2d8ec" }}>Sarah</span>
          <span className="ml-1.5 text-[10px]" style={{ color: "#5c5068" }}>2:43 PM</span>
          <p className="mt-0.5">the submit one I think? on settings?</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded" style={{ backgroundColor: "#2da563" }} />
        <div>
          <span className="text-[11px] font-semibold" style={{ color: "#e2d8ec" }}>Tim</span>
          <span className="ml-1.5 text-[10px]" style={{ color: "#5c5068" }}>2:51 PM</span>
          <p className="mt-0.5">can you file a ticket with the Figma link?</p>
        </div>
      </div>

      <div className="flex gap-2 opacity-40">
        <div className="mt-0.5 h-6 w-6 shrink-0 rounded" style={{ backgroundColor: "#6d5dfc" }} />
        <p className="mt-0.5">...</p>
      </div>

      {/* Time wasted indicator */}
      <div className="mt-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] font-medium" style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#ef4444" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="#ef4444" strokeWidth="1" />
          <path d="M6 3V6.5L8 8" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" />
        </svg>
        38 min and counting &middot; no ticket filed
      </div>
    </div>
  );
}

/* ── The "After" — a visual task card ── */
function BundleCard() {
  return (
    <div
      className="flex flex-col rounded-xl border text-[13px]"
      style={{
        borderColor: "rgba(234,88,12,0.2)",
        backgroundColor: "var(--compyl-surface)",
        boxShadow: "0 4px 32px rgba(234,88,12,0.08), 0 0 0 1px rgba(234,88,12,0.1)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b p-4" style={{ borderColor: "var(--compyl-border)" }}>
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded" style={{ backgroundColor: "var(--compyl-accent)" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="2" width="7" height="1.5" rx="0.75" fill="white" opacity="0.5" />
            <rect x="2" y="5" width="8" height="1.5" rx="0.75" fill="white" opacity="0.75" />
            <rect x="1.5" y="8" width="6" height="1.5" rx="0.75" fill="white" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold" style={{ color: "var(--compyl-text)" }}>
            Button color doesn&apos;t match design
          </h4>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: "#FFF7ED", color: "#9A3412" }}>Major</span>
            <span className="text-[11px]" style={{ color: "var(--compyl-text-muted)" }}>94% match</span>
          </div>
        </div>
      </div>

      {/* Source */}
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--compyl-border)" }}>
        <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "#f5f5f4", color: "#44403c", fontFamily: "var(--compyl-font-code)" }}>
          Button.tsx:42
        </span>
        <span className="text-[11px]" style={{ color: "var(--compyl-text-muted)" }}>&rarr;</span>
        <span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c3aed" }}>
          Figma: Submit Button
        </span>
      </div>

      {/* Criteria */}
      <div className="px-4 py-3">
        <ul className="flex flex-col gap-1.5">
          {["Background = #EA580C", "Hover \u2192 #DC4A04", "Radius: 8px"].map((c) => (
            <li key={c} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--compyl-text)" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <rect x="0.5" y="0.5" width="13" height="13" rx="3" stroke="var(--compyl-border)" />
                <path d="M4 7L6 9L10 5" stroke="var(--compyl-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t px-4 py-2" style={{ borderColor: "var(--compyl-border)" }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#22c55e" }} />
        <span className="text-[11px] font-medium" style={{ color: "#16a34a" }}>Ready for agent</span>
      </div>
    </div>
  );
}

/* ── Integration surfaces ── */
const SURFACES = [
  { label: "MCP", desc: "Pipe into Claude, Cursor, or any MCP agent.", code: "compyl://bundles/b-4f2a" },
  { label: "CLI", desc: "Pull, filter, assign. Fits your workflow.", code: "$ compyl pull --severity major" },
  { label: "API", desc: "Programmatic access. Build anything.", code: "GET /v1/bundles?status=open" },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function Home() {
  return (
    <div style={{ backgroundColor: "var(--compyl-bg)", color: "var(--compyl-text)" }}>
      {/* Accent bar */}
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #EA580C 0%, #FB923C 50%, #EA580C 100%)" }} />

      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Logo size="md" />
        <div className="flex items-center gap-5">
          <a href="#how" className="hidden text-sm font-medium sm:block" style={{ color: "var(--compyl-text-muted)" }}>How it works</a>
          <a href="/login" className="hidden text-sm font-medium sm:block" style={{ color: "var(--compyl-text-muted)" }}>Sign in</a>
          <a href="#waitlist" className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800">Get access</a>
        </div>
      </nav>

      {/* ── Screen 1: Hero + Before/After ── */}
      <section className="mx-auto max-w-5xl px-6 pt-12 sm:pt-16">
        <div className="text-center">
          <span
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ borderColor: "var(--compyl-accent)", color: "var(--compyl-accent)" }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--compyl-accent)" }} />
            Alpha
          </span>

          <h1 className="anim-blur-reveal mx-auto max-w-2xl text-[2.5rem] font-bold leading-[1.1] tracking-tight sm:text-6xl">
            Stop screenshotting{" "}
            <span style={{ color: "var(--compyl-accent)" }}>bugs into Slack.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-md text-base" style={{ color: "var(--compyl-text-muted)" }}>
            Visual feedback &rarr; structured tasks for AI agents and developers. Instantly.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#waitlist" className="w-full rounded-lg bg-stone-900 px-8 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-stone-800 sm:w-auto">
              Get early access
            </a>
            <a href="#how" className="w-full rounded-lg border px-8 py-3.5 text-sm font-semibold hover:bg-stone-50 sm:w-auto" style={{ borderColor: "var(--compyl-border)" }}>
              See how it works
            </a>
          </div>
        </div>

        {/* Before / After — tight, right below hero */}
        <div className="mx-auto mt-14 max-w-4xl">
          <div className="grid items-start gap-5 sm:grid-cols-[1fr_auto_1fr]">
            {/* Before */}
            <div>
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: "#7c6f8a" }}>Today</p>
              <SlackThread />
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center py-4 sm:pt-10">
              <div className="anim-pulse-glow flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--compyl-accent)" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* After */}
            <div>
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--compyl-accent)" }}>With Compyl</p>
              <BundleCard />
            </div>
          </div>
        </div>
      </section>

      {/* ── Screen 2: How it works — ultra tight ── */}
      <section
        id="how"
        className="mt-20 border-t border-b py-16"
        style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-surface)" }}
      >
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {([
              ["01", "Point at it.", "Click any element. Describe what\u2019s wrong. No code knowledge needed."],
              ["02", "Compyl resolves it.", "Source file, Figma design, component ancestry, confidence score. Milliseconds."],
              ["03", "Ship it.", "Structured task drops into Claude, Cursor, your CLI, or the triage board."],
            ] as const).map(([num, title, desc]) => (
              <div key={num} className="relative rounded-xl border p-5" style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-bg)" }}>
                <span
                  className="absolute -top-3 left-5 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: "var(--compyl-accent)", color: "white", fontFamily: "var(--compyl-font-code)" }}
                >
                  {num}
                </span>
                <h3 className="mt-1 text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--compyl-text-muted)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Screen 3: Integrations — compressed ── */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">Works with your stack.</h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {SURFACES.map((s) => (
            <div key={s.label} className="rounded-xl border p-5" style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-surface)" }}>
              <span
                className="inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider"
                style={{ borderColor: "var(--compyl-accent)", color: "var(--compyl-accent)", fontFamily: "var(--compyl-font-code)" }}
              >
                {s.label}
              </span>
              <p className="mt-3 text-sm" style={{ color: "var(--compyl-text-muted)" }}>{s.desc}</p>
              <div className="mt-3 rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: "#1c1917", color: "#d6d3d1", fontFamily: "var(--compyl-font-code)" }}>
                {s.code}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Screen 4: Waitlist + Footer ── */}
      <section id="waitlist" className="mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-2xl border p-8 text-center sm:p-12" style={{ borderColor: "var(--compyl-border)", backgroundColor: "var(--compyl-surface)" }}>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Join the alpha.
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--compyl-text-muted)" }}>
            We&apos;ll reach out when your seat is ready.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <WaitlistForm />
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-5xl items-center justify-between border-t px-6 py-6" style={{ borderColor: "var(--compyl-border)" }}>
        <Logo size="sm" wordmark={false} />
        <div className="flex items-center gap-5">
          <a href="https://github.com/idan82labs/Compyl" className="text-xs font-medium" style={{ color: "var(--compyl-text-muted)" }}>GitHub</a>
          <span className="text-xs" style={{ color: "var(--compyl-text-muted)" }}>&copy; 2026 Compyl</span>
        </div>
      </footer>
    </div>
  );
}
