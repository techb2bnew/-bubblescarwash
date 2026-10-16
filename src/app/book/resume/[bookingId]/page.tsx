import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "../../../_components/site-header";
import SiteFooter from "../../../_components/site-footer";
import { formatDateLong, formatTimeLabel } from "@/lib/date-utils";
import { getBusinessTimezone } from "@/lib/google-calendar";
import { getStripeClient } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import ResumeCheckout from "./resume-checkout";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ResumeRow {
  status: string;
  payment_status: string;
  stripe_checkout_session_id: string | null;
  customer_name: string;
  booking_date: string;
  booking_time: string;
  price: number | null;
  service_name: string | null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center bg-gray-50 px-4 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-lg">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Notice({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "bad";
}) {
  const box =
    tone === "bad"
      ? "border-red-100 bg-red-50"
      : "border-gray-100 bg-white";
  return (
    <div className={`rounded-3xl border p-8 text-center shadow-sm ${box}`}>
      <h1 className="text-lg font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
      <Link
        href="/book"
        className="mt-6 inline-block rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm"
      >
        Book a new slot
      </Link>
    </div>
  );
}

export default async function ResumeBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  if (!UUID.test(bookingId)) {
    return (
      <Shell>
        <Notice
          tone="bad"
          title="Booking not found"
          body="This link doesn't look right. Please start a new booking."
        />
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_booking_resume", { p_booking_id: bookingId })
    .single();
  const booking = data as ResumeRow | null;

  if (!booking) {
    return (
      <Shell>
        <Notice
          tone="bad"
          title="Booking not found"
          body="We couldn't find this booking. Please start a new one."
        />
      </Shell>
    );
  }

  // Already paid — nothing left to do but show the confirmation.
  if (booking.payment_status === "paid") {
    redirect(`/book/confirmation?booking_id=${bookingId}`);
  }

  if (booking.payment_status !== "pending" || !booking.stripe_checkout_session_id) {
    return (
      <Shell>
        <Notice
          title="This slot is no longer being held"
          body="The payment window for this booking has closed, so the slot was released. You can pick a new time in a minute."
        />
      </Shell>
    );
  }

  const stripe = getStripeClient();
  const session = stripe
    ? await stripe.checkout.sessions
        .retrieve(booking.stripe_checkout_session_id)
        .catch(() => null)
    : null;

  // Paid in Stripe but the webhook hasn't landed yet — the confirmation page
  // already knows how to wait for it.
  if (session?.payment_status === "paid") {
    redirect(`/book/confirmation?booking_id=${bookingId}`);
  }

  if (!session || session.status !== "open" || !session.client_secret) {
    return (
      <Shell>
        <Notice
          title="This payment window has expired"
          body="The 30 minutes we hold a slot for have passed, so it was released. Please book again — it only takes a minute."
        />
      </Shell>
    );
  }

  const holdUntil = new Intl.DateTimeFormat("en-AU", {
    timeStyle: "short",
    timeZone: getBusinessTimezone(),
  }).format(new Date((session.expires_at ?? 0) * 1000));

  return (
    <Shell>
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">Complete your payment</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your slot is held until <strong>{holdUntil}</strong>. Pay now to confirm it.
        </p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Service</dt>
            <dd className="font-medium text-gray-900">{booking.service_name ?? "Car Wash"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">When</dt>
            <dd className="font-medium text-gray-900">
              {formatDateLong(booking.booking_date)}, {formatTimeLabel(booking.booking_time.slice(0, 5))}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Name</dt>
            <dd className="font-medium text-gray-900">{booking.customer_name}</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
        <ResumeCheckout clientSecret={session.client_secret} />
      </div>
    </Shell>
  );
}
