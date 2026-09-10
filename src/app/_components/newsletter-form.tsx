"use client";

import { useState } from "react";
import { subscribeToNewsletter } from "./newsletter-actions";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const result = await subscribeToNewsletter(email);
    if (result.ok) {
      setStatus("sent");
      setEmail("");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <p className="flex w-full max-w-sm items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2.5 text-sm font-semibold text-brand-300 sm:w-auto">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 flex-none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        You&apos;re subscribed — thanks!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-2 sm:w-auto">
      <div className="flex w-full gap-2">
        <input
          type="email"
          required
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="flex-none rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {status === "submitting" ? "Joining..." : "Join"}
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
