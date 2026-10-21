"use client";

import { loadStripe } from "@stripe/stripe-js";
import StripeCheckoutFrame from "../../stripe-checkout-frame";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function ResumeCheckout({ clientSecret }: { clientSecret: string }) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-red-600">
        Online payment isn&apos;t set up right now. Please call us to complete your booking.
      </p>
    );
  }
  return <StripeCheckoutFrame stripePromise={stripePromise} clientSecret={clientSecret} />;
}
