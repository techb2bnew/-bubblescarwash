import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toDateKey } from "@/lib/date-utils";
import RevenueChart from "./revenue-chart";

const NAV_CARDS = [
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
    href: "/admin/calendar",
    title: "Calendar",
    desc: "Block off days the car wash is closed",
    icon: (
      <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
    ),
  },
  {
    href: "/admin/bookings",
    title: "Bookings",
    desc: "View and manage customer bookings",
    icon: (
      <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 7h8M8 13h8M8 16h5" />
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
    { data: recentTransactions },
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
      .select("id, customer_name, booking_date, price, status, services(name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const totalRevenue = (revenueBookings ?? []).reduce(
    (sum, b) => sum + (b.price ?? 0),
    0,
  );

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

      <RevenueChart bookings={revenueBookings ?? []} />

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recent Transactions
          </h2>
          <Link
            href="/admin/bookings"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2">Date</th>
                <th className="px-5 py-2">Customer</th>
                <th className="px-5 py-2">Service</th>
                <th className="px-5 py-2">Amount</th>
                <th className="px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recentTransactions ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3 text-gray-600">{t.booking_date}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {t.customer_name}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {(t.services as unknown as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-900">
                    {t.price != null ? `$${t.price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        t.status === "completed"
                          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                          : t.status === "cancelled"
                            ? "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
                            : "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(recentTransactions ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="h-5" />
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
              className="group rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-300 hover:shadow-md"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 group-hover:bg-brand-50 group-hover:text-brand-600">
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
              <h3 className="mt-3 font-medium text-gray-900">{c.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
