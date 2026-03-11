import { auth } from "../../auth";
import { redirect } from "next/navigation";
import { TriageWorkspace } from "./triage-workspace";

/**
 * Developer Triage Workspace — tabbed view (Bundles + Activity).
 *
 * Requires Auth.js session (team members only).
 * Shows ExecutionBundles and Agent Activity for the project.
 */
export default async function TriagePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // TODO: resolve projectId from session/URL once multi-project is wired
  const projectId = "default";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b border-[var(--compyl-border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold">Compyl Triage</h1>
          <p className="mt-1 text-sm text-[var(--compyl-text-muted)]">
            Review and assign feedback items
          </p>
        </div>
        <div className="text-sm text-[var(--compyl-text-muted)]">{session.user.email}</div>
      </header>
      <TriageWorkspace projectId={projectId} />
    </main>
  );
}
