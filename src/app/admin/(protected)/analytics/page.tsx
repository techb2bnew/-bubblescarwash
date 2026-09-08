import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RevenueChart from "./revenue-chart";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const [{ data: revenueBookings }, { data: recentTransactions }] = await Promise.all([
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Revenue trends and recent booking activity.
        </p>
      </div>

      <RevenueChart bookings={revenueBookings ?? []} />

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm ring-1 ring-black/[0.03]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12h4l3 8 4-16 3 8h4" />
              </svg>
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Recent Transactions
            </h2>
          </div>
          <Link
            href="/admin/bookings"
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-2">Customer</th>
                <th className="px-5 py-2">Date</th>
                <th className="px-5 py-2">Service</th>
                <th className="px-5 py-2">Amount</th>
                <th className="px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recentTransactions ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                        {t.customer_name
                          .split(" ")
                          .map((p: string) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-900">
                        {t.customer_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{t.booking_date}</td>
                  <td className="px-5 py-3 text-gray-600">
                    {(t.services as unknown as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">
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
    </div>
  );
}
