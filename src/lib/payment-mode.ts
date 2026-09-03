import { getStripeClient, isStripeEnabled } from "@/lib/stripe";

export type PaymentMode = "stripe" | "simple";

/**
 * Single source of truth for whether the booking flow and gift-card
 * purchase flow use Stripe Checkout or the manual "pay in person" form.
 * `IS_STRIPE=true` is an explicit operator override — it's checked
 * alongside key presence so a misconfigured flag fails safe to "simple"
 * rather than crashing at checkout time.
 */
export function getPaymentMode(): PaymentMode {
  return isStripeEnabled() && getStripeClient() ? "stripe" : "simple";
}
