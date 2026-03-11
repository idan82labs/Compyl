import { redirect } from "next/navigation";
import { TriageWorkspace } from "../../triage/triage-workspace";

/**
 * E2E test-only page for the developer triage workspace.
 * Renders TriageWorkspace without auth for Playwright testing.
 * Redirects to / in production.
 */
export default function E2ETriagePage() {
  if (process.env["NODE_ENV"] === "production") {
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">Triage Workspace (E2E Test)</h1>
        <p className="mt-1 text-sm text-gray-500">
          Developer view with full provenance context
        </p>
      </header>
      <TriageWorkspace projectId="e2e-test-project" />
    </main>
  );
}
