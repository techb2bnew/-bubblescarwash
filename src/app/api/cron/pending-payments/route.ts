import { NextResponse } from "next/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  reconcilePendingPayments,
  sendPendingPaymentReminders,
} from "@/lib/stripe-payments";
import { syncBookingsToGoogle } from "@/lib/booking-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meant to be hit every few minutes by a cron job (cPanel → Cron Jobs):
 *   curl -s "https://<site>/api/cron/pending-payments?key=<CRON_SECRET>"
 * Settles checkouts whose Stripe webhook never arrived, then sends the
 * "still pending — please confirm the payment" reminder to customers whose
 * checkout has been open for 10+ minutes. Safe to run as often as you like.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }

  const url = new URL(request.url);
  const supplied =
    url.searchParams.get("key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "Service role key is not set" }, { status: 503 });
  }

  // No admin is logged in here, so read bookings with the service-role client.
  const admin = createAdminClient();
  await reconcilePendingPayments(admin);
  const reminders = await sendPendingPaymentReminders(admin);
  await syncBookingsToGoogle(admin);

  return NextResponse.json({ ok: true, remindersSent: reminders });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
