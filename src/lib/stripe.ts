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

export function getStripeCurrency(): string {
  return process.env.STRIPE_CURRENCY ?? "aud";
}
