import { createClient } from "@/lib/supabase/server";
import type { BlockedDate, Booking, BusinessSettings } from "@/lib/types";
import BookingsTable from "./bookings-table";

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const [
    { data: bookings },
    { data: inclusions },
    { data: blockedDates },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, services(*, service_inclusions(inclusion_id))")
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: false }),
    supabase.from("inclusions").select("id, name"),
    supabase.from("blocked_dates").select("*"),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
  ]);

  const inclusionNames: Record<string, string> = Object.fromEntries(
    (inclusions ?? []).map((i) => [i.id, i.name]),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Bookings</h1>
        <p className="mt-1 text-sm text-gray-500">
          All customer bookings, newest first.
        </p>
      </div>
      <BookingsTable
        bookings={(bookings as Booking[]) ?? []}
        inclusionNames={inclusionNames}
        blockedDates={(blockedDates as BlockedDate[]) ?? []}
        settings={settings as BusinessSettings}
      />
    </div>
  );
}
