"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getGiftCardPaymentStatus, type GiftCardPaymentStatus } from "../actions";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15; // ~30s of polling before we give up and say "still confirming"

export default function GiftCardConfirmationStatus({
  giftCardId,
  initial,
}: {
  giftCardId: string;
  initial: GiftCardPaymentStatus | null;
}) {
  const [result, setResult] = useState<GiftCardPaymentStatus | null>(initial);
  const [pollsLeft, setPollsLeft] = useState(MAX_POLLS);

  useEffect(() => {
    if (!result || result.paymentStatus !== "pending" || pollsLeft <= 0) return;
    const timer = setTimeout(async () => {
      const next = await getGiftCardPaymentStatus(giftCardId);
      setResult(next);
      setPollsLeft((p) => p - 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [result, pollsLeft, giftCardId]);

  if (!result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-800">Gift card not found</h1>
        <p className="mt-2 text-sm text-red-700">
          We couldn&apos;t find that gift card. If you were charged, please
          contact us with your reference.
        </p>
        <Link
          href="/gift-cards"
          className="mt-4 inline-block text-sm font-medium text-brand-600 underline"
        >
          Back to gift cards
        </Link>
      </div>
    );
  }

  if (result.paymentStatus === "paid") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-green-800">
          Gift Card Purchased!
        </h1>
        <p className="mt-2 text-sm text-green-700">
          Value: ${result.value != null ? result.value.toFixed(2) : "—"}
        </p>
        <div className="mt-3 rounded-md border border-dashed border-green-300 bg-white p-4">
          <p className="text-xs text-green-700">Gift card code</p>
          <p className="mt-1 text-2xl font-bold tracking-widest text-green-900">
            {result.code}
          </p>
        </div>
        <p className="mt-3 text-xs text-green-600">
          We&apos;ve also emailed this code
          {result.recipientName ? ` to ${result.recipientName}` : ""}.
        </p>
      </div>
    );
  }

  if (result.paymentStatus === "pending" && pollsLeft > 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          Confirming your payment…
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This usually only takes a few seconds. Please don&apos;t close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
      <h1 className="text-lg font-semibold text-amber-800">
        {result.paymentStatus === "pending"
          ? "Still confirming…"
          : "Payment not completed"}
      </h1>
      <p className="mt-2 text-sm text-amber-700">
        {result.paymentStatus === "pending"
          ? "We're still waiting to hear back from Stripe. If this doesn't update shortly, please contact us."
          : "Your payment didn't go through, so no gift card was issued. Please try again."}
      </p>
      <Link
        href="/gift-cards"
        className="mt-4 inline-block text-sm font-medium text-brand-600 underline"
      >
        Back to gift cards
      </Link>
    </div>
  );
}
