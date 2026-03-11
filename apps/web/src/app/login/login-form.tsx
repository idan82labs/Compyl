"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-6 shadow-sm"
      style={{
        borderColor: "var(--compyl-border)",
        backgroundColor: "var(--compyl-surface)",
      }}
    >
      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium"
          style={{ color: "var(--compyl-text)" }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border px-3 py-2 text-sm outline-none transition-colors focus:border-ember-600 focus:ring-1 focus:ring-ember-600"
          style={{
            borderColor: "var(--compyl-border)",
            backgroundColor: "var(--compyl-surface)",
            color: "var(--compyl-text)",
          }}
          placeholder="you@company.com"
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium"
          style={{ color: "var(--compyl-text)" }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded border px-3 py-2 text-sm outline-none transition-colors focus:border-ember-600 focus:ring-1 focus:ring-ember-600"
          style={{
            borderColor: "var(--compyl-border)",
            backgroundColor: "var(--compyl-surface)",
            color: "var(--compyl-text)",
          }}
        />
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-2 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
