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
      <div className="mt-0.5 text-brand-600">
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
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Revenue
          </h2>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatCurrency(total)}
            <span className="ml-2 text-sm font-normal text-gray-400">
              this {granularity === "day" ? "30 days" : granularity === "week" ? "12 weeks" : granularity === "month" ? "12 months" : "5 years"}
            </span>
          </p>
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

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
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
            <Bar dataKey="total" fill="#f2600a" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
