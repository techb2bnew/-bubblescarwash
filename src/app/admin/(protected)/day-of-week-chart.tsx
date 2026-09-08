"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_CHROME } from "@/lib/chart-colors";

export interface DayCount {
  day: string;
  count: number;
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
      <div className="mt-0.5 text-gray-500">{payload[0].value} bookings</div>
    </div>
  );
}

export default function DayOfWeekChart({ data }: { data: DayCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm ring-1 ring-black/[0.03]">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
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
            <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
          </svg>
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Bookings by Day of Week
        </h2>
      </div>

      <div className="p-5">
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            No bookings yet.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: CHART_CHROME.axisText }}
                  axisLine={{ stroke: CHART_CHROME.axis }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: CHART_CHROME.axisText }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#faf5f0" }} />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  fill="var(--color-brand-500)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
