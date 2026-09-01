import {
  createClosedDayEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server";

export async function onBlockedDateCreated(
  date: string,
  reason: string | null,
): Promise<void> {
  try {
    const result = await createClosedDayEvent(date, reason);
    if (!result?.eventId) return;

    const supabase = await createClient();
    const { error } = await supabase
      .from("blocked_dates")
      .update({ google_event_id: result.eventId })
      .eq("date", date);

    if (error) {
      console.error("[blocked-date-sync] failed to save google_event_id:", error);
    }
  } catch (err) {
    console.error("[blocked-date-sync] onBlockedDateCreated failed:", err);
  }
}

export async function onBlockedDateRemoved(date: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("blocked_dates")
      .select("google_event_id")
      .eq("date", date)
      .maybeSingle();

    const eventId = data?.google_event_id;
    if (eventId) {
      await deleteCalendarEvent(eventId);
    }
  } catch (err) {
    console.error("[blocked-date-sync] onBlockedDateRemoved failed:", err);
  }
}

/** Backfill Google Calendar events for blocked days missing google_event_id. */
export async function syncBlockedDatesToGoogle(): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("blocked_dates")
      .select("date, reason, google_event_id")
      .is("google_event_id", null);

    if (error || !rows?.length) return;

    for (const row of rows) {
      const result = await createClosedDayEvent(row.date, row.reason);
      if (!result?.eventId) continue;

      const { error: updateError } = await supabase
        .from("blocked_dates")
        .update({ google_event_id: result.eventId })
        .eq("date", row.date);

      if (updateError) {
        console.error(
          `[blocked-date-sync] failed to save google_event_id for ${row.date}:`,
          updateError,
        );
      }
    }
  } catch (err) {
    console.error("[blocked-date-sync] syncBlockedDatesToGoogle failed:", err);
  }
}
