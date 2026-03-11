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
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Triage Workspace</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and assign feedback items
          </p>
        </div>
        <div className="text-sm text-gray-600">{session.user.email}</div>
      </header>
      <TriageWorkspace projectId={projectId} />
    </main>
  );
}
