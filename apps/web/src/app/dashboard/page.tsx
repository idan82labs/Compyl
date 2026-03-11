import { auth } from "../../auth";
import { redirect } from "next/navigation";

/**
 * Dashboard page — requires Auth.js session (team members only).
 * Reporters NEVER see this page.
 */
export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="text-sm text-gray-600">{session.user.email}</div>
      </header>
      <p className="text-gray-500">Project list and session management coming soon.</p>
    </main>
  );
}
