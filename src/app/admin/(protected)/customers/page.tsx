import { createClient } from "@/lib/supabase/server";
import type { Booking, Customer, CustomerSummary } from "@/lib/types";
import CustomersPageClient from "./customers-page-client";

/** Matches how customers have always been grouped: by email, falling back to phone. */
function customerKey(email: string, phone: string): string {
  return email.trim().toLowerCase() || phone.trim();
}

function sortBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    const av = `${a.booking_date} ${a.booking_time}`;
    const bv = `${b.booking_date} ${b.booking_time}`;
    return av < bv ? 1 : av > bv ? -1 : 0;
  });
}

function summarize(
  key: string,
  id: string | null,
  name: string,
  phone: string,
  email: string,
  bookings: Booking[],
): CustomerSummary {
  const sorted = sortBookings(bookings);
  const totalSpent = bookings.reduce(
    (sum, b) => sum + (b.status === "cancelled" ? 0 : (b.price ?? 0)),
    0,
  );
  return {
    key,
    id,
    name,
    phone,
    email,
    bookingsCount: bookings.length,
    totalSpent,
    lastVisit: sorted[0]?.booking_date ?? "",
    bookings: sorted,
  };
}

function buildCustomerSummaries(
  customerRows: Customer[],
  bookings: Booking[],
): CustomerSummary[] {
  const bookingsByKey = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = customerKey(b.customer_email, b.customer_phone);
    const list = bookingsByKey.get(key);
    if (list) list.push(b);
    else bookingsByKey.set(key, [b]);
  }

  const consumedKeys = new Set<string>();
  const summaries: CustomerSummary[] = customerRows.map((c) => {
    const key = customerKey(c.email, c.phone);
    consumedKeys.add(key);
    return summarize(c.id, c.id, c.name, c.phone, c.email, bookingsByKey.get(key) ?? []);
  });

  // Bookings whose customer hasn't been synced into `customers` yet (should
  // be rare — see the trigger in 0036_customers.sql — but shown read-only
  // rather than silently dropped).
  for (const [key, bs] of bookingsByKey) {
    if (consumedKeys.has(key)) continue;
    const latest = sortBookings(bs)[0];
    summaries.push(
      summarize(key, null, latest.customer_name, latest.customer_phone, latest.customer_email, bs),
    );
  }

  return summaries;
}

export default async function AdminCustomersPage() {
  const supabase = await createClient();
  const [{ data: customerRows }, { data: bookings }] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("bookings").select("*, services(*)").order("booking_date", { ascending: false }),
  ]);

  const customers = buildCustomerSummaries(
    (customerRows as Customer[]) ?? [],
    (bookings as Booking[]) ?? [],
  );

  return <CustomersPageClient customers={customers} />;
}
