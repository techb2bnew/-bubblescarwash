"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { aggregateRevenue, type RevenueGranularity } from "@/lib/revenue-utils";
import { CHART_CHROME } from "@/lib/chart-colors";

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
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm ring-1 ring-black/[0.03]">
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
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: CHART_CHROME.axisText }}
              axisLine={{ stroke: CHART_CHROME.axis }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_CHROME.axisText }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: CHART_CHROME.axis, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-brand-600)"
              strokeWidth={2.5}
              fill="url(#revenueAreaFill)"
              dot={false}
              activeDot={{ r: 5, fill: "var(--color-brand-600)", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
