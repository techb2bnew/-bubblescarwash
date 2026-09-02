import { getBookingPaymentStatus } from "../actions";
import ConfirmationStatus from "./confirmation-status";

export const dynamic = "force-dynamic";

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  const { booking_id: bookingId } = await searchParams;
  const initial = bookingId ? await getBookingPaymentStatus(bookingId) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      {bookingId ? (
        <ConfirmationStatus bookingId={bookingId} initial={initial} />
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-800">Booking not found</h1>
          <p className="mt-2 text-sm text-red-700">
            No booking reference was provided.
          </p>
        </div>
      )}
    </div>
  );
}
