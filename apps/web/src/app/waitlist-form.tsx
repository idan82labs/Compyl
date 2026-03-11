"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <p className="text-sm" style={{ color: "var(--compyl-text-muted)" }}>
        Thanks! We'll be in touch at <strong style={{ color: "var(--compyl-text)" }}>{email}</strong>.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="you@company.com"
        className="flex-1 rounded-md border px-4 py-2.5 text-sm outline-none transition-colors"
        style={{
          borderColor: "var(--compyl-border)",
          backgroundColor: "var(--compyl-surface)",
          color: "var(--compyl-text)",
        }}
      />
      <button
        type="submit"
        className="rounded-md bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
      >
        Join waitlist
      </button>
    </form>
  );
}
