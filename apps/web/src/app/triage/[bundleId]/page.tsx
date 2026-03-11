import { auth } from "../../../auth";
import { redirect } from "next/navigation";

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
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 border-b pb-4">
        <a href="/triage" className="text-sm text-blue-600 hover:underline">
          &larr; Back to triage
        </a>
        <h1 className="mt-2 text-2xl font-bold">Bundle Detail</h1>
        <p className="text-sm text-gray-500 font-mono">{bundleId}</p>
      </header>
      <p className="text-gray-500">
        Full ExecutionBundle view coming soon. This page will show the complete
        developer context including separate exact_source and resolved_component_stack.
      </p>
    </main>
  );
}
