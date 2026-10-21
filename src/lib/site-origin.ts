import { headers } from "next/headers";

/** Everything except a local dev machine is served over HTTPS. */
function forceHttps(origin: string): string {
  if (!origin.startsWith("http://")) return origin;
  const host = origin.slice("http://".length).split("/")[0].split(":")[0];
  const local = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  return local ? origin : `https://${origin.slice("http://".length)}`;
}

/**
 * The site's own origin, for building Stripe success/cancel redirect URLs.
 * Always https outside local development, so a proxy that reports the wrong
 * protocol can never send a customer back to an insecure page mid-payment.
 */
export async function getSiteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return forceHttps(origin);
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return forceHttps(`${proto}://${host}`);
  return forceHttps(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}
