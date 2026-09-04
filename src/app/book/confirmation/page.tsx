import SiteHeader from "../../_components/site-header";
import SiteFooter from "../../_components/site-footer";
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
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-16">
        <div className="mx-auto w-full max-w-lg">
          {bookingId ? (
            <ConfirmationStatus bookingId={bookingId} initial={initial} />
          ) : (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center shadow-sm">
              <h1 className="text-lg font-bold text-red-800">Booking not found</h1>
              <p className="mt-2 text-sm text-red-700">
                No booking reference was provided.
              </p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
