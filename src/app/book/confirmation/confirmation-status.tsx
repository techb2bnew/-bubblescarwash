"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTimeLabel } from "@/lib/date-utils";
import { getBookingPaymentStatus, type BookingPaymentStatus } from "../actions";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15; // ~30s of polling before we give up and say "still confirming"

export default function ConfirmationStatus({
  bookingId,
  initial,
}: {
  bookingId: string;
  initial: BookingPaymentStatus | null;
}) {
  const [result, setResult] = useState<BookingPaymentStatus | null>(initial);
  const [pollsLeft, setPollsLeft] = useState(MAX_POLLS);

  useEffect(() => {
    if (!result || result.paymentStatus !== "pending" || pollsLeft <= 0) return;
    const timer = setTimeout(async () => {
      const next = await getBookingPaymentStatus(bookingId);
      setResult(next);
      setPollsLeft((p) => p - 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [result, pollsLeft, bookingId]);

  if (!result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-800">Booking not found</h1>
        <p className="mt-2 text-sm text-red-700">
          We couldn&apos;t find that booking. If you were charged, please contact
          us with your payment reference.
        </p>
        <Link
          href="/book"
          className="mt-4 inline-block text-sm font-medium text-brand-600 underline"
        >
          Back to booking
        </Link>
      </div>
    );
  }

  if (result.paymentStatus === "paid") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-green-800">
          Booking Confirmed!
        </h1>
        <p className="mt-2 text-sm text-green-700">Booking reference: {bookingId}</p>
        <p className="mt-1 text-sm text-green-700">
          {result.serviceName} on {result.bookingDate} at{" "}
          {formatTimeLabel(result.bookingTime.slice(0, 5))}
        </p>
        <p className="mt-1 text-sm font-medium text-green-800">
          Total paid: ${result.price != null ? result.price.toFixed(2) : "—"}
        </p>
        <p className="mt-3 text-xs text-green-600">
          A confirmation email is on its way to you.
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
          ? "We're still waiting to hear back from Stripe. If this doesn't update shortly, please contact us with your reference below before booking again."
          : "Your payment didn't go through, so this slot wasn't booked. Please try again."}
      </p>
      <p className="mt-1 text-xs text-amber-600">Reference: {bookingId}</p>
      <Link
        href="/book"
        className="mt-4 inline-block text-sm font-medium text-brand-600 underline"
      >
        Back to booking
      </Link>
    </div>
  );
}
