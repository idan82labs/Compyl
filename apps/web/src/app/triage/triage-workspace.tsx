"use client";

import { useState } from "react";
import { TriageList } from "./triage-list";
import { ActivityTab } from "./activity-tab";

type Tab = "bundles" | "activity";

/**
 * Developer triage workspace — tab container.
 *
 * Tabs:
 * - Bundles: ExecutionBundle list (default)
 * - Activity: Agent action audit log (developer-only)
 */
export function TriageWorkspace({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("bundles");

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        <TabButton
          label="Bundles"
          active={activeTab === "bundles"}
          onClick={() => setActiveTab("bundles")}
        />
        <TabButton
          label="Activity"
          active={activeTab === "activity"}
          onClick={() => setActiveTab("activity")}
        />
      </div>

      {/* Content */}
      {activeTab === "bundles" && <TriageList />}
      {activeTab === "activity" && <ActivityTab projectId={projectId} />}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-blue-500 text-blue-600"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}
