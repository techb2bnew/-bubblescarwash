import {
  createBlockedSlotEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
import { createClient } from "@/lib/supabase/server";

async function getSlotIntervalMinutes(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_settings")
    .select("slot_interval_minutes")
    .eq("id", 1)
    .single();
  return data?.slot_interval_minutes ?? 30;
}

function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

export async function onBlockedSlotCreated(
  date: string,
  time: string,
  reason: string | null,
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: slot } = await supabase
      .from("blocked_slots")
      .select("id, google_event_id")
      .eq("date", date)
      .eq("time", time)
      .maybeSingle();

    if (!slot || slot.google_event_id) return;

    const duration = await getSlotIntervalMinutes();
    const result = await createBlockedSlotEvent(
      date,
      time,
      duration,
      reason,
    );
    if (!result?.eventId) return;

    const { error } = await supabase
      .from("blocked_slots")
      .update({ google_event_id: result.eventId })
      .eq("id", slot.id);

    if (error) {
      console.error("[blocked-slot-sync] failed to save google_event_id:", error);
    }
  } catch (err) {
    console.error("[blocked-slot-sync] onBlockedSlotCreated failed:", err);
  }
}

export async function onBlockedSlotRemoved(
  date: string,
  time: string,
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: slot } = await supabase
      .from("blocked_slots")
      .select("google_event_id")
      .eq("date", date)
      .eq("time", time)
      .maybeSingle();

    if (slot?.google_event_id) {
      await deleteCalendarEvent(slot.google_event_id);
    }
  } catch (err) {
    console.error("[blocked-slot-sync] onBlockedSlotRemoved failed:", err);
  }
}

export async function onBlockedSlotsCreated(
  date: string,
  times: string[],
  reason: string | null,
): Promise<void> {
  await Promise.all(
    times.map((time) => onBlockedSlotCreated(date, time, reason)),
  );
}

/** Backfill Google Calendar events for blocked slots missing google_event_id. */
export async function syncBlockedSlotsToGoogle(): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("blocked_slots")
      .select("date, time, reason, google_event_id")
      .is("google_event_id", null);

    if (error || !rows?.length) return;

    const duration = await getSlotIntervalMinutes();

    for (const row of rows) {
      const result = await createBlockedSlotEvent(
        row.date,
        row.time,
        duration,
        row.reason,
      );
      if (!result?.eventId) continue;

      const { error: updateError } = await supabase
        .from("blocked_slots")
        .update({ google_event_id: result.eventId })
        .eq("date", row.date)
        .eq("time", row.time);

      if (updateError) {
        console.error(
          `[blocked-slot-sync] failed to save google_event_id for ${row.date} ${normalizeTime(row.time)}:`,
          updateError,
        );
      }
    }
  } catch (err) {
    console.error("[blocked-slot-sync] syncBlockedSlotsToGoogle failed:", err);
  }
}
