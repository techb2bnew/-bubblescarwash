"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockedDate, BusinessSettings } from "@/lib/types";
import {
  formatTimeLabel,
  generateTimeSlots,
  getMonthGrid,
  isSameMonth,
  MONTH_NAMES,
  startOfToday,
  toDateKey,
  unavailableDateStyle,
  WEEKDAY_NAMES,
} from "@/lib/date-utils";
import {
  blockDate,
  blockSlot,
  getDateAvailability,
  unblockDate,
  unblockSlot,
} from "./actions";

export default function CalendarView({
  blockedDates,
  settings,
}: {
  blockedDates: BlockedDate[];
  settings: BusinessSettings;
}) {
  const router = useRouter();
  const today = useMemo(() => startOfToday(), []);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(() => toDateKey(today));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const blockedByDate = useMemo(() => {
    const map = new Map<string, BlockedDate>();
    blockedDates.forEach((b) => map.set(b.date, b));
    return map;
  }, [blockedDates]);

  const weeks = useMemo(
    () => getMonthGrid(cursor.year, cursor.month),
    [cursor],
  );

  const timeSlots = useMemo(
    () =>
      generateTimeSlots(
        settings.opening_time,
        settings.closing_time,
        settings.slot_interval_minutes,
      ),
    [settings],
  );

  const dayIsClosed = selected ? blockedByDate.has(selected) : false;

  useEffect(() => {
    if (!selected || dayIsClosed) return;
    const dateKey = selected;
    let cancelled = false;
    async function loadAvailability() {
      setLoadingSlots(true);
      try {
        const result = await getDateAvailability(dateKey);
        if (cancelled) return;
        setBookedTimes(result.bookedTimes);
        setBlockedTimes(result.blockedSlots.map((s) => s.time.slice(0, 5)));
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [selected, dayIsClosed]);

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

  async function handleToggleSlot(time: string) {
    if (!selected) return;
    setSavingSlot(time);
    try {
      if (blockedTimes.includes(time)) {
        await unblockSlot(selected, `${time}:00`);
        setBlockedTimes((prev) => prev.filter((t) => t !== time));
      } else {
        await blockSlot(selected, `${time}:00`, "");
        setBlockedTimes((prev) => [...prev, time]);
      }
      router.refresh();
    } finally {
      setSavingSlot(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-4 lg:flex-row">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 lg:flex-none">
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
                title={isBlocked ? blockedByDate.get(key)?.reason || "Closed" : undefined}
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
      </div>

      {selected && (
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 lg:flex-1">
          <p className="mb-2 text-sm text-gray-700">
            {selected}{" "}
            {dayIsClosed
              ? `— currently closed${blockedByDate.get(selected)?.reason ? ` (${blockedByDate.get(selected)?.reason})` : ""}`
              : "— currently available"}
          </p>
          {!dayIsClosed && (
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
              {dayIsClosed ? "Mark as available" : "Mark as closed"}
            </button>
            <button
              onClick={() => setSelected(null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>

          {!dayIsClosed && (
            <div className="mt-4 border-t border-gray-200 pt-3">
              <p className="mb-2 text-xs font-medium text-gray-700">
                Block individual time slots on this day:
              </p>
              {loadingSlots ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {timeSlots.map((t) => {
                    const booked = bookedTimes.includes(t);
                    const blocked = blockedTimes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={booked || savingSlot === t}
                        onClick={() => handleToggleSlot(t)}
                        style={blocked ? unavailableDateStyle : undefined}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          booked
                            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                            : blocked
                              ? "border-red-200 text-red-600 hover:border-red-300"
                              : "border-gray-300 text-gray-600 hover:border-brand-300 hover:text-brand-700"
                        }`}
                      >
                        {formatTimeLabel(t)}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded border border-gray-300 bg-gray-100" />{" "}
                  Booked
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-3 w-3 rounded border border-red-200"
                    style={unavailableDateStyle}
                  />{" "}
                  Blocked
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded border border-gray-300" />{" "}
                  Available
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
