import { toDateKey } from "./date-utils";

export type RevenueGranularity = "day" | "week" | "month" | "year";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function bucketKeyForDate(date: Date, granularity: RevenueGranularity): string {
  if (granularity === "day") return toDateKey(date);
  if (granularity === "week") return toDateKey(startOfWeek(date));
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${date.getFullYear()}`;
}

function labelForKey(key: string, granularity: RevenueGranularity): string {
  if (granularity === "day" || granularity === "week") {
    const [, m, d] = key.split("-").map(Number);
    return `${MONTH_SHORT[m - 1]} ${d}`;
  }
  if (granularity === "month") {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_SHORT[m - 1]} ${y}`;
  }
  return key;
}

const WINDOW_SIZE: Record<RevenueGranularity, number> = {
  day: 30,
  week: 12,
  month: 12,
  year: 5,
};

/** Generates the chronological list of bucket keys/labels ending today. */
function generateBuckets(
  granularity: RevenueGranularity,
): { key: string; label: string }[] {
  const count = WINDOW_SIZE[granularity];
  const today = new Date();
  const buckets: { key: string; label: string }[] = [];

  for (let i = count - 1; i >= 0; i--) {
    let d: Date;
    if (granularity === "day") {
      d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    } else if (granularity === "week") {
      d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7);
    } else if (granularity === "month") {
      d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    } else {
      d = new Date(today.getFullYear() - i, 0, 1);
    }
    const key = bucketKeyForDate(d, granularity);
    buckets.push({ key, label: labelForKey(key, granularity) });
  }
  return buckets;
}

export interface RevenuePoint {
  label: string;
  total: number;
}

export function aggregateRevenue(
  bookings: { booking_date: string; price: number | null }[],
  granularity: RevenueGranularity,
): RevenuePoint[] {
  const totals = new Map<string, number>();

  for (const b of bookings) {
    if (!b.price) continue;
    const [y, m, d] = b.booking_date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const key = bucketKeyForDate(date, granularity);
    totals.set(key, (totals.get(key) ?? 0) + b.price);
  }

  return generateBuckets(granularity).map((bucket) => ({
    label: bucket.label,
    total: Math.round((totals.get(bucket.key) ?? 0) * 100) / 100,
  }));
}
