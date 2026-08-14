import { createClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/types";
import BookingsTable from "./bookings-table";

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, services(*)")
    .order("booking_date", { ascending: false })
    .order("booking_time", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Bookings</h1>
        <p className="mt-1 text-sm text-gray-500">
          All customer bookings, newest first.
        </p>
      </div>
      <BookingsTable bookings={(bookings as Booking[]) ?? []} />
    </div>
  );
}
