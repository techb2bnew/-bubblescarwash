import { createClient } from "@/lib/supabase/server";
import type { BlockedDate } from "@/lib/types";
import CalendarView from "./calendar-view";

export default async function AdminCalendarPage() {
  const supabase = await createClient();
  const { data: blockedDates } = await supabase
    .from("blocked_dates")
    .select("*")
    .order("date");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Click a date to mark the car wash as closed. Closed dates show as
          unavailable on the customer booking calendar.
        </p>
      </div>
      <CalendarView blockedDates={(blockedDates as BlockedDate[]) ?? []} />
    </div>
  );
}
