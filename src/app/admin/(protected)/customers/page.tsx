import { createClient } from "@/lib/supabase/server";
import type { Booking, CustomerSummary } from "@/lib/types";
import CustomersPageClient from "./customers-page-client";

function aggregateCustomers(bookings: Booking[]): CustomerSummary[] {
  const byKey = new Map<string, CustomerSummary>();

  for (const b of bookings) {
    const key = b.customer_email.trim().toLowerCase() || b.customer_phone.trim();
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        key,
        name: b.customer_name,
        phone: b.customer_phone,
        email: b.customer_email,
        bookingsCount: 1,
        totalSpent: b.status === "cancelled" ? 0 : (b.price ?? 0),
        lastVisit: b.booking_date,
        bookings: [b],
      });
      continue;
    }

    existing.bookingsCount += 1;
    if (b.status !== "cancelled") existing.totalSpent += b.price ?? 0;
    if (b.booking_date > existing.lastVisit) {
      existing.lastVisit = b.booking_date;
      existing.name = b.customer_name;
      existing.phone = b.customer_phone;
    }
    existing.bookings.push(b);
  }

  for (const c of byKey.values()) {
    c.bookings.sort((a, b) => {
      const av = `${a.booking_date} ${a.booking_time}`;
      const bv = `${b.booking_date} ${b.booking_time}`;
      return av < bv ? 1 : av > bv ? -1 : 0;
    });
  }

  return Array.from(byKey.values());
}

export default async function AdminCustomersPage() {
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, services(*)")
    .order("booking_date", { ascending: false });

  const customers = aggregateCustomers((bookings as Booking[]) ?? []);

  return <CustomersPageClient customers={customers} />;
}
