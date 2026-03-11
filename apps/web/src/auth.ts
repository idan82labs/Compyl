/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Phase 1: Credentials provider (email/password) for team members.
 * Phase 2+: Add OAuth providers (Google, GitHub) as needed.
 *
 * Reporter sessions do NOT use Auth.js — they use capability URLs.
 * Auth.js is exclusively for team members (member/admin/owner roles).
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@company.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Phase 1: validate against API server
        // The API server owns user storage and password hashing
        const apiBase = process.env["API_URL"] ?? "http://localhost:3001";

        try {
          const res = await fetch(`${apiBase}/api/v1/auth/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          });

          if (!res.ok) return null;

          const user = (await res.json()) as {
            id: string;
            email: string;
            name: string;
            organizationId: string;
            role: string;
          };

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token["id"] = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token["id"] && session.user) {
        session.user.id = token["id"] as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
