import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toDateKey } from "@/lib/date-utils";
import BookingBreakdownChart from "./booking-breakdown-chart";
import DayOfWeekChart from "./day-of-week-chart";

const WEEKDAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const NAV_CARDS = [
  {
    href: "/admin/bookings",
    title: "Bookings",
    desc: "View and manage customer bookings",
    icon: (
      <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 7h8M8 13h8M8 16h5" />
    ),
  },
  {
    href: "/admin/customers",
    title: "Customers",
    desc: "See everyone who has booked and their history",
    icon: (
      <path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0a4 4 0 0 0 3-6.65M20 20v-1a4 4 0 0 0-3-3.85" />
    ),
  },
  {
    href: "/admin/analytics",
    title: "Analytics",
    desc: "Revenue trends and recent transaction history",
    icon: (
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    ),
  },
  {
    href: "/admin/services",
    title: "Services",
    desc: "Manage wash & detailing prices per vehicle type",
    icon: (
      <path d="M9 4h6l5 5.5a2 2 0 0 1 0 2.8L14.3 18a2 2 0 0 1-2.8 0L5 11.5V6a2 2 0 0 1 2-2Zm.5 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    ),
  },
  {
    href: "/admin/add-ons",
    title: "Add-Ons",
    desc: "Manage the feature checklist shown per service",
    icon: <path d="m5 13 4 4L19 7" />,
  },
  {
    href: "/admin/categories",
    title: "Categories",
    desc: "Manage wash & detailing service categories",
    icon: <path d="M4 6h16M4 12h16M4 18h7" />,
  },
  {
    href: "/admin/vehicle-types",
    title: "Vehicle Types",
    desc: "Manage the vehicle options customers choose from",
    icon: (
      <path d="M3 13.5 5 8a2 2 0 0 1 2-1.5h10A2 2 0 0 1 19 8l2 5.5M3 13.5V18a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-4.5M3 13.5h18M7 16.5h.01M17 16.5h.01" />
    ),
  },
  {
    href: "/admin/calendar",
    title: "Calendar",
    desc: "Block off days the car wash is closed",
    icon: (
      <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
    ),
  },
];

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const today = toDateKey(new Date());

  const [
    { count: activeServices },
    { count: upcomingBookings },
    { count: closedDays },
    { data: revenueBookings },
    { data: breakdownBookings },
    { count: totalBookingsCount },
    { data: customerEmails },
    { count: totalServicesCount },
    { count: totalAddOnsCount },
    { count: totalCategoriesCount },
    { count: totalVehicleTypesCount },
    { count: totalBlockedDatesCount },
  ] = await Promise.all([
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("booking_date", today),
    supabase
      .from("blocked_dates")
      .select("*", { count: "exact", head: true })
      .gte("date", today),
    supabase
      .from("bookings")
      .select("booking_date, price")
      .neq("status", "cancelled"),
    supabase
      .from("bookings")
      .select("booking_date, services(name)")
      .neq("status", "cancelled"),
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase.from("bookings").select("customer_email"),
    supabase.from("services").select("*", { count: "exact", head: true }),
    supabase.from("inclusions").select("*", { count: "exact", head: true }),
    supabase.from("service_categories").select("*", { count: "exact", head: true }),
    supabase.from("vehicle_types").select("*", { count: "exact", head: true }),
    supabase.from("blocked_dates").select("*", { count: "exact", head: true }),
  ]);

  const totalRevenue = (revenueBookings ?? []).reduce(
    (sum, b) => sum + (b.price ?? 0),
    0,
  );

  const totalCustomersCount = new Set(
    (customerEmails ?? []).map((c) => c.customer_email.trim().toLowerCase()),
  ).size;

  const navCounts: Record<string, number> = {
    "/admin/bookings": totalBookingsCount ?? 0,
    "/admin/customers": totalCustomersCount,
    "/admin/services": totalServicesCount ?? 0,
    "/admin/add-ons": totalAddOnsCount ?? 0,
    "/admin/categories": totalCategoriesCount ?? 0,
    "/admin/vehicle-types": totalVehicleTypesCount ?? 0,
    "/admin/calendar": totalBlockedDatesCount ?? 0,
  };

  const breakdownCounts = new Map<string, number>();
  for (const b of breakdownBookings ?? []) {
    const name =
      (b.services as unknown as { name: string } | null)?.name ?? "Unknown";
    breakdownCounts.set(name, (breakdownCounts.get(name) ?? 0) + 1);
  }
  const breakdownData = Array.from(breakdownCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const dayCounts = new Array(7).fill(0);
  for (const b of breakdownBookings ?? []) {
    const [y, m, d] = b.booking_date.split("-").map(Number);
    const dayIndex = new Date(y, m - 1, d).getDay();
    dayCounts[dayIndex] += 1;
  }
  const dayOfWeekData = WEEKDAY_FULL.map((day, i) => ({
    day,
    count: dayCounts[i],
  }));

  const stats = [
    {
      label: "Total Revenue",
      value: `$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: (
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      ),
    },
    {
      label: "Active Services",
      value: activeServices ?? 0,
      icon: <path d="M9 4h6l5 5.5a2 2 0 0 1 0 2.8L14.3 18a2 2 0 0 1-2.8 0L5 11.5V6a2 2 0 0 1 2-2Z" />,
    },
    {
      label: "Upcoming Bookings",
      value: upcomingBookings ?? 0,
      icon: (
        <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 7h8M8 13h8" />
      ),
    },
    {
      label: "Closed Days Upcoming",
      value: closedDays ?? 0,
      icon: (
        <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          A quick look at how the business is set up right now.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {s.icon}
              </svg>
            </span>
            <div>
              <div className="text-2xl font-semibold text-gray-900">
                {s.value}
              </div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Manage
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-300 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 group-hover:bg-brand-50 group-hover:text-brand-600">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {c.icon}
                </svg>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">{c.title}</h3>
                  {navCounts[c.href] != null && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 group-hover:bg-brand-50 group-hover:text-brand-700">
                      {navCounts[c.href]}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BookingBreakdownChart data={breakdownData} />
        <DayOfWeekChart data={dayOfWeekData} />
      </div>
    </div>
  );
}
