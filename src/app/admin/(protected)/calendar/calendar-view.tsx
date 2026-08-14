"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockedDate } from "@/lib/types";
import {
  getMonthGrid,
  isSameMonth,
  MONTH_NAMES,
  startOfToday,
  toDateKey,
  unavailableDateStyle,
  WEEKDAY_NAMES,
} from "@/lib/date-utils";
import { blockDate, unblockDate } from "./actions";

export default function CalendarView({
  blockedDates,
}: {
  blockedDates: BlockedDate[];
}) {
  const router = useRouter();
  const today = useMemo(() => startOfToday(), []);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const blockedByDate = useMemo(() => {
    const map = new Map<string, BlockedDate>();
    blockedDates.forEach((b) => map.set(b.date, b));
    return map;
  }, [blockedDates]);

  const weeks = useMemo(
    () => getMonthGrid(cursor.year, cursor.month),
    [cursor],
  );

  function changeMonth(delta: number) {
    setSelected(null);
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  async function handleToggle(dateKey: string) {
    setSaving(true);
    try {
      if (blockedByDate.has(dateKey)) {
        await unblockDate(dateKey);
      } else {
        await blockDate(dateKey, reason);
      }
      setReason("");
      setSelected(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => changeMonth(-1)}
          className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          «
        </button>
        <span className="font-medium text-gray-900">
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </span>
        <button
          onClick={() => changeMonth(1)}
          className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          »
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
        {WEEKDAY_NAMES.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date) => {
          const key = toDateKey(date);
          const inMonth = isSameMonth(date, cursor.year, cursor.month);
          const isBlocked = blockedByDate.has(key);
          const isPast = date < today;
          const isSelected = selected === key;

          const isUnavailable = isPast || isBlocked;

          return (
            <button
              key={key}
              disabled={isPast}
              onClick={() => setSelected(isSelected ? null : key)}
              style={isUnavailable ? unavailableDateStyle : undefined}
              className={`aspect-square rounded text-sm ${
                !inMonth ? "text-gray-300" : ""
              } ${isPast ? "cursor-not-allowed text-gray-400" : "hover:bg-gray-100"} ${
                isBlocked && inMonth ? "text-gray-500" : ""
              } ${isSelected ? "ring-2 ring-brand-500" : ""}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span
            className="h-3 w-3 rounded border border-gray-300"
            style={unavailableDateStyle}
          />{" "}
          Closed
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-gray-300" /> Available
        </span>
      </div>

      {selected && (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-sm text-gray-700">
            {selected}{" "}
            {blockedByDate.has(selected)
              ? `— currently closed${blockedByDate.get(selected)?.reason ? ` (${blockedByDate.get(selected)?.reason})` : ""}`
              : "— currently available"}
          </p>
          {!blockedByDate.has(selected) && (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="mb-2 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleToggle(selected)}
              disabled={saving}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {blockedByDate.has(selected) ? "Mark as available" : "Mark as closed"}
            </button>
            <button
              onClick={() => setSelected(null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
