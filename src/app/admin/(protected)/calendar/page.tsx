import { createClient } from "@/lib/supabase/server";
import type { BlockedDate, BusinessSettings } from "@/lib/types";
import CalendarView from "./calendar-view";

export default async function AdminCalendarPage() {
  const supabase = await createClient();
  const [{ data: blockedDates }, { data: settings }] = await Promise.all([
    supabase.from("blocked_dates").select("*").order("date"),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Click a date to mark the car wash as closed, or block individual
          time slots on a day that stays open.
        </p>
      </div>
      <CalendarView
        blockedDates={(blockedDates as BlockedDate[]) ?? []}
        settings={settings as BusinessSettings}
      />
    </div>
  );
}
