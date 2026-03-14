import { auth } from "../../auth";
import { redirect } from "next/navigation";
import { TriageWorkspace } from "./triage-workspace";
import { Logo } from "@compyl/ui";

/**
 * Developer Triage Workspace — full-viewport 3-panel layout.
 * Requires Auth.js session (team members only).
 */
export default async function TriagePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const projectId = "default";

  return (
    <div className="dark flex h-screen flex-col" style={{ backgroundColor: "#0C0A09", color: "#fafaf9" }}>
      {/* Global app header */}
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#292524] px-5" style={{ backgroundColor: "#0C0A09" }}>
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </a>
          <div className="h-4 w-px bg-[#292524]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#a8a29e]">Triage</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-[#a8a29e]">{session.user.email}</span>
        </div>
      </header>

      {/* Workspace fills remaining height */}
      <TriageWorkspace projectId={projectId} />
    </div>
  );
}
