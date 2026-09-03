import { getBusinessTimezone } from "@/lib/google-calendar";

export interface IcsEventInput {
  uid: string;
  summary: string;
  description: string;
  location: string | null;
  startDate: string;
  startTime: string;
  durationMinutes: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcsDateTime(date: string, time: string): string {
  const [y, mo, d] = date.split("-");
  const [h, mi] = time.slice(0, 5).split(":");
  return `${y}${mo}${d}T${pad(Number(h))}${pad(Number(mi))}00`;
}

function addMinutes(
  date: string,
  time: string,
  durationMinutes: number,
): { date: string; time: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.slice(0, 5).split(":").map(Number);
  const total = h * 60 + mi + durationMinutes;
  const dayOffset = Math.floor(total / (24 * 60));
  const minutesInDay = total % (24 * 60);
  const endDate = new Date(y, mo - 1, d + dayOffset);
  return {
    date: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`,
    time: `${pad(Math.floor(minutesInDay / 60))}:${pad(minutesInDay % 60)}`,
  };
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Build an .ics file so email clients show "Add to calendar". */
export function buildBookingIcs(input: IcsEventInput): string {
  const tz = getBusinessTimezone();
  const end = addMinutes(input.startDate, input.startTime, input.durationMinutes);
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bubbles Car Wash//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${tz}:${toIcsDateTime(input.startDate, input.startTime)}`,
    `DTEND;TZID=${tz}:${toIcsDateTime(end.date, end.time)}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
  ];

  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Google "Add to Calendar" link (works in browser without .ics). */
export function buildGoogleCalendarAddLink(input: {
  summary: string;
  description: string;
  location: string | null;
  startDate: string;
  startTime: string;
  durationMinutes: number;
}): string {
  const end = addMinutes(input.startDate, input.startTime, input.durationMinutes);
  const start = toIcsDateTime(input.startDate, input.startTime);
  const endDt = toIcsDateTime(end.date, end.time);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.summary,
    dates: `${start}/${endDt}`,
    details: input.description,
    ctz: getBusinessTimezone(),
  });
  if (input.location) params.set("location", input.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function formatTimezoneLabel(): string {
  const tz = getBusinessTimezone();
  try {
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(new Date());
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
    return tzName;
  } catch {
    return tz;
  }
}
