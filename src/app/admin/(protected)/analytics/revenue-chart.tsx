"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { aggregateRevenue, type RevenueGranularity } from "@/lib/revenue-utils";

const TABS: { key: RevenueGranularity; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
];

const WINDOW_LABEL: Record<RevenueGranularity, string> = {
  day: "30 days",
  week: "12 weeks",
  month: "12 months",
  year: "5 years",
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-gray-900">{label}</div>
      <div className="mt-0.5 font-semibold text-brand-600">
        {formatCurrency(payload[0].value)}
      </div>
    </div>
  );
}

export default function RevenueChart({
  bookings,
}: {
  bookings: { booking_date: string; price: number | null }[];
}) {
  const [granularity, setGranularity] = useState<RevenueGranularity>("month");

  const data = useMemo(
    () => aggregateRevenue(bookings, granularity),
    [bookings, granularity],
  );

  const total = useMemo(
    () => data.reduce((sum, p) => sum + p.total, 0),
    [data],
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
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
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Revenue
            </h2>
            <p className="text-2xl font-semibold text-gray-900">
              {formatCurrency(total)}
              <span className="ml-2 text-sm font-normal text-gray-400">
                this {WINDOW_LABEL[granularity]}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-md bg-gray-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setGranularity(t.key)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                granularity === t.key
                  ? "bg-white text-brand-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full p-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="revenueBarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff8a24" />
                <stop offset="100%" stopColor="#d9480a" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#fff3e6" }} />
            <Bar
              dataKey="total"
              fill="url(#revenueBarFill)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
