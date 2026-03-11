import { auth } from "../../../auth";
import { redirect } from "next/navigation";
import { BundleDetail } from "./bundle-detail";

interface Props {
  params: Promise<{ bundleId: string }>;
}

/**
 * Developer bundle detail page.
 *
 * Shows the FULL ExecutionBundle including:
 * - Provenance: exact_source (separate), resolved_component_stack (separate)
 * - Resolution metadata: resolution_mode, missing_reasons, root_boundary_kind
 * - Technical context: dom_selector, computed_styles, severity
 * - AI-generated: acceptance_criteria, validation_steps, confidence
 * - Lifecycle: status, assignee
 *
 * This page is auth-gated — only team members see it.
 * Reporters NEVER access this page.
 */
export default async function BundleDetailPage({ params }: Props) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { bundleId } = await params;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div
        className="dark min-h-screen rounded-lg p-6"
        style={{
          backgroundColor: "var(--compyl-bg)",
          color: "var(--compyl-text)",
        }}
      >
        <header className="mb-8 border-b border-[var(--compyl-border)] pb-4">
          <a
            href="/triage"
            className="inline-flex items-center gap-1 text-sm text-[var(--compyl-accent)] hover:underline"
          >
            &larr; Back to Compyl Triage
          </a>
          <h1 className="mt-2 text-2xl font-bold text-[var(--compyl-text)]">
            Compyl Bundle Detail
          </h1>
          <p className="mt-1 font-mono text-sm text-[var(--compyl-text-muted)]">
            {bundleId}
          </p>
        </header>

        <BundleDetail bundleId={bundleId} />
      </div>
    </main>
  );
}
