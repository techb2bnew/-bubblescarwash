"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/admin/reset-password` },
    );

    setLoading(false);
    // Deliberately the same outcome whether or not the address belongs to an
    // account — the form must not reveal which emails are registered. Only a
    // genuine send failure (rate limit, mail provider) surfaces as an error.
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
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
            Reset Password
          </h1>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              If an admin account exists for <strong>{email}</strong>,
              a password reset link is on its way. The link opens a page where
              you can set a new password, and expires after an hour.
            </p>
            <Link
              href="/admin/login"
              className="block w-full rounded-md bg-brand-600 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter your admin email and we&apos;ll send you a link to set a new
              password.
            </p>
            <div>
              <label
                htmlFor="reset-email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <Link
              href="/admin/login"
              className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
