import { createClient } from "@/lib/supabase/server";
import { syncBlockedDatesToGoogle } from "@/lib/blocked-date-sync";
import { syncBlockedSlotsToGoogle } from "@/lib/blocked-slot-sync";
import type { BlockedDate, BusinessSettings } from "@/lib/types";
import { getWeekdayHours } from "../actions";
import SetOperationsView from "../set-operations-view";

export const dynamic = "force-dynamic";

export default async function SetOperationsPage() {
  await Promise.all([syncBlockedDatesToGoogle(), syncBlockedSlotsToGoogle()]);

  const supabase = await createClient();
  const [{ data: blockedDates }, { data: settings }, weekdayHours] = await Promise.all([
    supabase.from("blocked_dates").select("*").order("date"),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    getWeekdayHours(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Set Operations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Booth capacity, business hours, closed days, blocked slots, and
          recurring weekly hours — pick a date, then manage it below.
        </p>
      </div>
      <SetOperationsView
        blockedDates={(blockedDates as BlockedDate[]) ?? []}
        settings={settings as BusinessSettings}
        weekdayHours={weekdayHours}
      />
    </div>
  );
}
