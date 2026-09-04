import { createClient } from "@/lib/supabase/server";
import { syncBlockedDatesToGoogle } from "@/lib/blocked-date-sync";
import { syncBlockedSlotsToGoogle } from "@/lib/blocked-slot-sync";
import { getGoogleCalendarEmbedUrl } from "@/lib/google-calendar";
import type { BlockedDate, BusinessSettings, Service } from "@/lib/types";
import { getWeekdayHours } from "./actions";
import CalendarView from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  await Promise.all([
    syncBlockedDatesToGoogle(),
    syncBlockedSlotsToGoogle(),
  ]);

  const supabase = await createClient();
  const [{ data: blockedDates }, { data: settings }, { data: services }, weekdayHours] =
    await Promise.all([
      supabase.from("blocked_dates").select("*").order("date"),
      supabase.from("business_settings").select("*").eq("id", 1).single(),
      supabase.from("services").select("*").eq("active", true).order("name"),
      getWeekdayHours(),
    ]);

  const googleCalendarEmbedUrl = getGoogleCalendarEmbedUrl("MONTH");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          View bookings on Google Calendar and manage availability from the
          panel on the right.
        </p>
      </div>
      <CalendarView
        blockedDates={(blockedDates as BlockedDate[]) ?? []}
        settings={settings as BusinessSettings}
        services={(services as Service[]) ?? []}
        weekdayHours={weekdayHours}
        googleCalendarEmbedUrl={googleCalendarEmbedUrl}
      />
    </div>
  );
}
