import Link from "next/link";
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
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Payment cancelled</h1>
        <p className="mt-2 text-sm text-gray-600">
          You weren&apos;t charged and your time slot has been released.
        </p>
        <Link
          href="/book"
          className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Book again
        </Link>
      </div>
    </div>
  );
}
