import Link from "next/link";
import SiteHeader from "../../_components/site-header";
import SiteFooter from "../../_components/site-footer";
import { cancelUnpaidBooking } from "../actions";

export const dynamic = "force-dynamic";

export default async function BookingCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { booking_id: bookingId } = await searchParams;
  if (bookingId) {
    await cancelUnpaidBooking(bookingId);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-16">
        <div className="mx-auto w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-gray-900">Payment cancelled</h1>
          <p className="mt-2 text-sm text-gray-600">
            You weren&apos;t charged and your time slot has been released.
          </p>
          <Link
            href="/book"
            className="mt-5 inline-block rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Book again
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
