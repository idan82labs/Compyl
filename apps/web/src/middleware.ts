/**
 * Next.js middleware for Auth.js session protection.
 *
 * Protected routes: /dashboard, /project, /triage (team member routes).
 * Unprotected routes: /session/* (reporter capability URLs), /login, /api/auth.
 *
 * Reporter session pages are NEVER gated by Auth.js — the session ID
 * in the path IS the credential (capability URL model).
 */

export { auth as middleware } from "./auth";

export const config = {
  matcher: ["/dashboard/:path*", "/project/:path*", "/triage/:path*"],
};
