import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getStaffPermissions, hasPermission } from "@/lib/admin-role";
import { getGoogleCalendarEmbedUrl } from "@/lib/google-calendar";
import type { BlockedDate, Booking, BusinessSettings } from "@/lib/types";
import BookingsTable from "./bookings-table";

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const [{ data: bookings }, { data: blockedDates }, { data: settings }, role, permissions] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, services(*, inclusions(*)), booking_extras(id, booking_id, extra_id, name, price, created_at)")
      .order("created_at", { ascending: false }),
    supabase.from("blocked_dates").select("*"),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    getAdminRole(),
    getStaffPermissions(),
  ]);
  const googleCalendarEmbedUrl = getGoogleCalendarEmbedUrl("WEEK");
  const canCreateBooking = hasPermission(role, permissions, "calendar", "create");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">
            All customer bookings, newest first.
          </p>
        </div>
        {canCreateBooking && (
          <Link
            href="/admin/calendar"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Create Booking
          </Link>
        )}
      </div>
      <BookingsTable
        bookings={(bookings as Booking[]) ?? []}
        blockedDates={(blockedDates as BlockedDate[]) ?? []}
        settings={settings as BusinessSettings}
        canEdit={hasPermission(role, permissions, "bookings", "edit")}
        googleCalendarEmbedUrl={googleCalendarEmbedUrl}
      />
    </div>
  );
}
