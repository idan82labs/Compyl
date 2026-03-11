/**
 * CompylProvider — same-origin annotation SDK entry point.
 *
 * Mounts the annotation overlay ONLY when a valid review token is present.
 * Zero overhead in normal staging use — checks for token on mount, no-ops otherwise.
 *
 * Architecture:
 * - Cost on click, not on render
 * - Canonical same-origin path (no iframe, no proxy)
 * - SDK captures reporter-level data only
 * - Provenance resolution happens server-side
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import type { AnnotationMode, AnnotationPayload } from "./types.js";

export interface CompylConfig {
  /** API endpoint base URL. */
  apiUrl: string;
  /** Review session token (from invite link). */
  sessionToken?: string;
  /** Override: force-enable SDK even without token (for development). */
  forceEnable?: boolean;
}

interface CompylContextValue {
  /** Whether the SDK is active (token present and valid). */
  active: boolean;
  /** Current annotation mode. */
  mode: AnnotationMode | null;
  /** Set the annotation mode. */
  setMode: (mode: AnnotationMode | null) => void;
  /** Submit an annotation to the API. */
  submitAnnotation: (payload: AnnotationPayload) => Promise<void>;
  /** Session ID (set after token validation). */
  sessionId: string | null;
}

const CompylContext = createContext<CompylContextValue>({
  active: false,
  mode: null,
  setMode: () => {},
  submitAnnotation: async () => {},
  sessionId: null,
});

export function useCompyl() {
  return useContext(CompylContext);
}

export function CompylProvider({
  config,
  children,
}: {
  config: CompylConfig;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<AnnotationMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Activate only when token is present
  useEffect(() => {
    if (!config.sessionToken && !config.forceEnable) {
      return; // Zero overhead — no token, no activation
    }

    // Validate token and get session
    const activate = async () => {
      try {
        const res = await fetch(`${config.apiUrl}/api/v1/invites/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: config.sessionToken }),
        });

        if (res.ok) {
          const data = (await res.json()) as { session_id: string };
          setSessionId(data.session_id);
          setActive(true);
        }
      } catch {
        // SDK fails silently — graceful degradation
        console.warn("[Compyl] Failed to activate session");
      }
    };

    if (config.sessionToken) {
      void activate();
    } else if (config.forceEnable) {
      setActive(true);
    }
  }, [config.sessionToken, config.forceEnable, config.apiUrl]);

  const submitAnnotation = async (payload: AnnotationPayload) => {
    if (!sessionId) return;

    await fetch(`${config.apiUrl}/api/v1/sessions/${sessionId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  return (
    <CompylContext.Provider
      value={{ active, mode, setMode, submitAnnotation, sessionId }}
    >
      {children}
    </CompylContext.Provider>
  );
}
