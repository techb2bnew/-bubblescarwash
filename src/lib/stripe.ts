import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!cached) {
    cached = new Stripe(secretKey);
  }
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Explicit operator override — set independently of whether keys are present. */
export function isStripeEnabled(): boolean {
  return process.env.IS_STRIPE === "true";
}

export function getStripeCurrency(): string {
  return process.env.STRIPE_CURRENCY ?? "aud";
}
