import { SessionReview } from "./session-review";

interface Props {
  params: Promise<{ sessionId: string }>;
}

/**
 * Reporter session review page.
 *
 * This is the page a reviewer lands on via their capability URL.
 * The session ID in the path IS the credential (Lite/Agency tier).
 *
 * Shows ONLY reporter-safe fields:
 * - Session: session_id, project_id, status, started_at, bundles
 * - Bundle: id, title, summary, category, screenshot_url, client_raw_text,
 *           reference_images, status, created_at
 *
 * NEVER shows: file paths, component stacks, severity, acceptance criteria,
 * design diffs, or any developer/provenance fields.
 */
export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <SessionReview sessionId={sessionId} />
    </main>
  );
}
