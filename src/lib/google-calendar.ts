import { google } from "googleapis";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!email || !privateKey || !calendarId) {
    return null;
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: [CALENDAR_SCOPE],
  });

  return {
    calendar: google.calendar({ version: "v3", auth }),
    calendarId,
  };
}

export function getBusinessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE ?? "Australia/Sydney";
}

/** Public embed URL for the admin calendar page (read-only view). */
export function getGoogleCalendarEmbedUrl(mode: "MONTH" | "WEEK" | "AGENDA" = "MONTH"): string | null {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) return null;

  const params = new URLSearchParams({
    src: calendarId,
    ctz: getBusinessTimezone(),
    mode,
    showTitle: "0",
    showNav: "1",
    showDate: "1",
    showPrint: "0",
    showTabs: "1",
    showCalendars: "0",
  });

  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  startDate: string;
  startTime: string;
  durationMinutes: number;
}

function addMinutesToBooking(
  date: string,
  time: string,
  durationMinutes: number,
): { date: string; time: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.slice(0, 5).split(":").map(Number);
  const startMs = Date.UTC(y, mo - 1, d, h, mi);
  const endMs = startMs + durationMinutes * 60_000;
  const end = new Date(endMs);
  return {
    date: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
    time: `${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`,
  };
}

function toDateTime(date: string, time: string): string {
  return `${date}T${time.slice(0, 5)}:00`;
}

export async function createCalendarEvent(
  input: CalendarEventInput,
): Promise<{ eventId: string; htmlLink: string | null } | null> {
  const client = getCalendarClient();
  if (!client) return null;

  const tz = getBusinessTimezone();
  const end = addMinutesToBooking(
    input.startDate,
    input.startTime,
    input.durationMinutes,
  );

  try {
    const response = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: toDateTime(input.startDate, input.startTime), timeZone: tz },
        end: { dateTime: toDateTime(end.date, end.time), timeZone: tz },
      },
    });

    if (!response.data.id) return null;
    return {
      eventId: response.data.id,
      htmlLink: response.data.htmlLink ?? null,
    };
  } catch (err) {
    console.error("[google-calendar] create failed:", err);
    return null;
  }
}

export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput,
): Promise<{ htmlLink: string | null } | null> {
  const client = getCalendarClient();
  if (!client) return null;

  const tz = getBusinessTimezone();
  const end = addMinutesToBooking(
    input.startDate,
    input.startTime,
    input.durationMinutes,
  );

  try {
    const response = await client.calendar.events.update({
      calendarId: client.calendarId,
      eventId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: toDateTime(input.startDate, input.startTime), timeZone: tz },
        end: { dateTime: toDateTime(end.date, end.time), timeZone: tz },
      },
    });

    return { htmlLink: response.data.htmlLink ?? null };
  } catch (err) {
    console.error("[google-calendar] update failed:", err);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const client = getCalendarClient();
  if (!client) return false;

  try {
    await client.calendar.events.delete({
      calendarId: client.calendarId,
      eventId,
    });
    return true;
  } catch (err) {
    console.error("[google-calendar] delete failed:", err);
    return false;
  }
}

function nextCalendarDate(date: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const next = new Date(y, mo - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

/** All-day event shown on Google Calendar when admin marks a day closed. */
export async function createClosedDayEvent(
  date: string,
  reason: string | null,
): Promise<{ eventId: string } | null> {
  const client = getCalendarClient();
  if (!client) return null;

  try {
    const response = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: {
        summary: reason ? `CLOSED — ${reason}` : "CLOSED",
        description: "This day is blocked for bookings.",
        start: { date },
        end: { date: nextCalendarDate(date) },
        colorId: "11",
        transparency: "opaque",
      },
    });

    if (!response.data.id) return null;
    return { eventId: response.data.id };
  } catch (err) {
    console.error("[google-calendar] closed day create failed:", err);
    return null;
  }
}

/** Timed event for a blocked booking slot. */
export async function createBlockedSlotEvent(
  date: string,
  time: string,
  durationMinutes: number,
  reason: string | null,
): Promise<{ eventId: string } | null> {
  const client = getCalendarClient();
  if (!client) return null;

  const tz = getBusinessTimezone();
  const end = addMinutesToBooking(date, time, durationMinutes);

  try {
    const response = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: {
        summary: reason ? `BLOCKED — ${reason}` : "BLOCKED",
        description: "This time slot is blocked for bookings.",
        start: { dateTime: toDateTime(date, time), timeZone: tz },
        end: { dateTime: toDateTime(end.date, end.time), timeZone: tz },
        colorId: "11",
        transparency: "opaque",
      },
    });

    if (!response.data.id) return null;
    return { eventId: response.data.id };
  } catch (err) {
    console.error("[google-calendar] blocked slot create failed:", err);
    return null;
  }
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_CALENDAR_ID,
  );
}
