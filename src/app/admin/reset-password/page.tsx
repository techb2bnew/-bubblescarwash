"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LinkState = "checking" | "ready" | "invalid";

/** Supabase reports a dead or already-used link in the query or the hash. */
function readLinkError(): string | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const description =
    query.get("error_description") ?? hash.get("error_description");
  const code = query.get("error") ?? hash.get("error");
  if (!description && !code) return null;
  return description ?? "This reset link is no longer valid.";
}

export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The emailed link lands here carrying a one-time code. The browser client
  // exchanges it for a session on its own (detectSessionInUrl), so all this
  // has to do is wait for that session to show up — it's what authorises the
  // updateUser call below.
  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    function settle(next: LinkState, message: string | null) {
      if (settled) return;
      settled = true;
      setLinkError(message);
      setLinkState(next);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) settle("ready", null);
    });

    // Fallback for when the exchange finished before this subscription
    // existed, and the place a dead link gets reported - Supabase leaves its
    // error in the URL rather than firing an auth event.
    const timer = setTimeout(async () => {
      const failure = readLinkError();
      if (failure) {
        settle("invalid", failure);
        return;
      }
      const { data } = await supabase.auth.getSession();
      settle(
        data.session ? "ready" : "invalid",
        data.session
          ? null
          : "This reset link has expired or has already been used. Request a new one.",
      );
    }, 1200);

    return () => {
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center">
          <Image
            src="/Bubbles-Logo.png"
            alt="Bubbles Car Wash & Cafe"
            width={641}
            height={428}
            priority
            className="h-16 w-auto"
          />
          <h1 className="mt-3 text-xl font-semibold text-gray-900">
            Set A New Password
          </h1>
        </div>

        {linkState === "checking" && (
          <p className="text-center text-sm text-gray-500">
            Checking your reset link...
          </p>
        )}

        {linkState === "invalid" && (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{linkError}</p>
            <Link
              href="/admin/forgot-password"
              className="block w-full rounded-md bg-brand-600 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
            >
              Request a new link
            </Link>
          </div>
        )}

        {linkState === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
