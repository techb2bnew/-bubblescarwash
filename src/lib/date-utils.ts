import type { CSSProperties } from "react";
import type { BoothCapacityDuration } from "@/lib/types";

/** Diagonal strike-through look for unavailable calendar dates. */
export const unavailableDateStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(to top right, transparent calc(50% - 1px), #fca5a5 50%, transparent calc(50% + 1px))",
};

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const WEEKDAY_FULL_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** Day of week for a "YYYY-MM-DD" key. 0 = Sunday … 6 = Saturday, matching Postgres `dow`. */
export function weekdayOfDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Returns a 6x7 grid of Date objects for the given month, padded with adjacent-month days. */
export function getMonthGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const weeks: Date[][] = [];
  let cursor = gridStart;
  for (let week = 0; week < 6; week++) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day++) {
      days.push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

export function isSameMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Generates "HH:MM" slots between opening/closing "HH:MM:SS" times at the given interval. */
export function generateTimeSlots(
  opening: string,
  closing: string,
  intervalMinutes: number,
): string[] {
  const [openH, openM] = opening.split(":").map(Number);
  const [closeH, closeM] = closing.split(":").map(Number);
  const slots: string[] = [];
  let minutes = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  while (minutes < end) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    minutes += intervalMinutes;
  }
  return slots;
}

/** "HH:MM" (or "HH:MM:SS") to minutes since midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/** Clock-hour bucket for capacity ("09:00" and "09:30" both map to "09:00"). */
export function hourBucketKey(time: string): string {
  const [h] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:00`;
}

/**
 * Every clock-hour bucket a booking occupies. A 10:30 booking lasting 60
 * minutes draws from both the 10:00 and 11:00 pools, so it counts once in
 * each — the same rule capacity is enforced by.
 */
export function bookingHourBuckets(
  startTime: string,
  durationMinutes: number,
): string[] {
  const [h, m] = startTime.slice(0, 5).split(":").map(Number);
  const startMinutes = h * 60 + m;
  const endMinutes = startMinutes + durationMinutes;
  const buckets: string[] = [];
  let hourStart = Math.floor(startMinutes / 60) * 60;
  while (hourStart < endMinutes) {
    buckets.push(`${String(Math.floor(hourStart / 60)).padStart(2, "0")}:00`);
    hourStart += 60;
  }
  return buckets;
}

export function formatDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

/** End date (inclusive) for a booth capacity period starting on startDate. */
export function boothPeriodEndDate(
  startDate: string,
  duration: BoothCapacityDuration,
): string {
  if (duration === "day") return startDate;
  if (duration === "week") return addDaysToDateKey(startDate, 6);
  if (duration === "ongoing") return "2099-12-31";
  const [y, m, d] = startDate.split("-").map(Number);
  return toDateKey(new Date(y, m, d - 1));
}

export function isOngoingBoothPeriod(duration: BoothCapacityDuration): boolean {
  return duration === "ongoing";
}
