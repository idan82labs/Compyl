"use client";

import { useState } from "react";
import { TriageList } from "./triage-list";
import { ActivityTab } from "./activity-tab";

type Tab = "bundles" | "activity";

/**
 * Developer triage workspace — 3-panel layout for bundles, tab switch for activity.
 * Wrapped in .dark for Compyl Ember dark palette.
 */
export function TriageWorkspace({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("bundles");

  return (
    <div
      className="dark flex h-[calc(100vh-80px)] flex-col"
      style={{ backgroundColor: "var(--compyl-bg)", color: "var(--compyl-text)" }}
    >
      {/* Top bar with tabs */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[var(--compyl-border)] px-4">
        <TabButton label="Bundles" active={activeTab === "bundles"} onClick={() => setActiveTab("bundles")} />
        <TabButton label="Activity" active={activeTab === "activity"} onClick={() => setActiveTab("activity")} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "bundles" && <TriageList />}
        {activeTab === "activity" && (
          <div className="h-full overflow-y-auto p-6">
            <ActivityTab projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
        active
          ? "border-b-2 border-[var(--compyl-accent)] text-[var(--compyl-accent)]"
          : "text-[var(--compyl-text-muted)] hover:text-[var(--compyl-text)]"
      }`}
    >
      {label}
    </button>
  );
}
