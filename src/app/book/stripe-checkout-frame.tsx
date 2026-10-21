"use client";

import { useEffect, useRef, useState } from "react";
import type { Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

// If the Stripe form hasn't drawn after this long, assume it's blocked or the
// network is struggling and give the customer something to do.
const LOAD_TIMEOUT_MS = 12_000;

/**
 * Stripe's embedded checkout with a visible loading state and a fallback.
 * Without this, a blocked Stripe script (ad-blocker, VPN, in-app browser,
 * weak signal) leaves the customer staring at an empty box.
 */
export default function StripeCheckoutFrame({
  stripePromise,
  clientSecret,
}: {
  stripePromise: Promise<Stripe | null>;
  clientSecret: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState("loading");
    let ready = false;
    // A slow connection can draw the form after the timeout fired, so "ready"
    // always wins over an earlier "failed".
    const finish = (next: "ready" | "failed") => {
      if (ready) return;
      if (next === "ready") ready = true;
      setState(next);
    };

    stripePromise.then((s) => !s && finish("failed")).catch(() => finish("failed"));

    const box = boxRef.current;
    const check = () => {
      if (box?.querySelector("iframe")) finish("ready");
    };
    const observer = new MutationObserver(check);
    if (box) observer.observe(box, { childList: true, subtree: true });
    check();

    const timer = window.setTimeout(() => finish("failed"), LOAD_TIMEOUT_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [stripePromise, attempt]);

  return (
    <div>
      {state === "loading" && (
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-gray-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" />
          Loading secure payment…
        </div>
      )}
      {state === "failed" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">The payment form didn&apos;t load.</p>
          <p className="mt-1">
            This is usually a weak connection, an ad-blocker or VPN, or a link opened inside
            another app (Instagram, Facebook, WhatsApp). Please try again, or open this page in
            Safari or Chrome. Your slot is still held for a few minutes.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Try again
          </button>
        </div>
      )}
      <div ref={boxRef} key={attempt} className={state === "failed" ? "hidden" : undefined}>
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
