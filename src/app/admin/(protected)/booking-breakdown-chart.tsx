"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORICAL_COLORS, CHART_CHROME } from "@/lib/chart-colors";

export interface BreakdownSlice {
  name: string;
  value: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: BreakdownSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-gray-900">{name}</div>
      <div className="mt-0.5 text-gray-500">{value} bookings</div>
    </div>
  );
}

export default function BookingBreakdownChart({
  data,
}: {
  data: BreakdownSlice[];
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  // Taller bars need more room; keep a sensible floor so a couple of
  // services don't render as two skinny lines in a tall empty card.
  const chartHeight = Math.max(160, data.length * 56);

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
            <path d="M3 12h4l3 8 4-16 3 8h4" />
          </svg>
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Bookings by Service
        </h2>
      </div>

      <div className="p-5">
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            No bookings yet.
          </p>
        ) : (
          <div style={{ height: chartHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 28, left: 4, bottom: 4 }}
                barCategoryGap="30%"
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 12, fill: "#374151" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#faf5f0" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {data.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                    />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    style={{ fill: CHART_CHROME.axisText, fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
