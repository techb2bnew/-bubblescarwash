"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockedDate, BoothCapacityDuration, BusinessSettings, HoursSource, WeekdayHours } from "@/lib/types";
import {
  boothPeriodEndDate,
  formatDateLong,
  formatTimeLabel,
  generateTimeSlots,
  isOngoingBoothPeriod,
  startOfToday,
  toDateKey,
  unavailableDateStyle,
  WEEKDAY_FULL_NAMES,
  weekdayOfDateKey,
} from "@/lib/date-utils";
import {
  blockDate,
  blockSlot,
  blockSlots,
  clearDateHours,
  clearWeekdayHours,
  getDateAvailability,
  setBoothCapacity,
  setDateHours,
  setWeekdayHours,
  unblockDate,
  unblockSlot,
} from "./actions";
import { useToast } from "../_components/toast";

type ActiveOp = "booths" | "hours" | "close" | "slots" | "weekly" | null;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function SetOperationsView({
  blockedDates,
  settings,
  weekdayHours,
}: {
  blockedDates: BlockedDate[];
  settings: BusinessSettings;
  weekdayHours: WeekdayHours[];
}) {
  const router = useRouter();
  const showToast = useToast();
  const today = useMemo(() => startOfToday(), []);
  const [selected, setSelected] = useState(() => toDateKey(today));
  const [activeOp, setActiveOp] = useState<ActiveOp>(null);

  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<string[]>([]);
  const [boothCount, setBoothCount] = useState(1);
  const [slotUsage, setSlotUsage] = useState<Map<string, number>>(new Map());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const [dateHours, setDateHoursState] = useState<{
    openingTime: string;
    closingTime: string;
    hoursSource: HoursSource;
  }>({
    openingTime: settings.opening_time.slice(0, 5),
    closingTime: settings.closing_time.slice(0, 5),
    hoursSource: "default",
  });
  const [hoursStart, setHoursStart] = useState("");
  const [hoursEnd, setHoursEnd] = useState("");
  const [savingHours, setSavingHours] = useState(false);

  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [weeklyDay, setWeeklyDay] = useState(0);
  const [weeklyStart, setWeeklyStart] = useState("");
  const [weeklyEnd, setWeeklyEnd] = useState("");
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const [boothInputCount, setBoothInputCount] = useState(2);
  const [boothDuration, setBoothDuration] = useState<BoothCapacityDuration | "hours">("week");
  const [boothStartDate, setBoothStartDate] = useState(() => toDateKey(today));
  const [boothHourStart, setBoothHourStart] = useState("11:00");
  const [boothHourEnd, setBoothHourEnd] = useState("15:00");
  const [savingBooths, setSavingBooths] = useState(false);
  const [boothError, setBoothError] = useState<string | null>(null);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [savingRange, setSavingRange] = useState(false);

  const blockedByDate = useMemo(() => {
    const map = new Map<string, BlockedDate>();
    blockedDates.forEach((b) => map.set(b.date, b));
    return map;
  }, [blockedDates]);

  const weekdayHoursByDay = useMemo(() => {
    const map = new Map<number, WeekdayHours>();
    weekdayHours.forEach((w) => map.set(w.day_of_week, w));
    return map;
  }, [weekdayHours]);

  const defaultOpening = settings.opening_time.slice(0, 5);
  const defaultClosing = settings.closing_time.slice(0, 5);

  const dayIsClosed = blockedByDate.has(selected);

  const timeSlots = useMemo(
    () => generateTimeSlots(dateHours.openingTime, dateHours.closingTime, settings.slot_interval_minutes),
    [dateHours, settings.slot_interval_minutes],
  );

  function hoursSourceLabel(source: HoursSource, dateKey: string): string {
    if (source === "date") return " (custom for this date)";
    if (source === "weekday") return ` (${WEEKDAY_FULL_NAMES[weekdayOfDateKey(dateKey)]} hours)`;
    return " (default)";
  }

  useEffect(() => {
    queueMicrotask(() => {
      setActiveOp(null);
      setReason("");
      setBoothStartDate(selected);
    });
  }, [selected]);

  useEffect(() => {
    if (dayIsClosed) return;
    const dateKey = selected;
    let cancelled = false;
    async function loadAvailability() {
      setLoadingSlots(true);
      try {
        const result = await getDateAvailability(dateKey);
        if (cancelled) return;
        setBookedTimes(result.bookedTimes);
        setBlockedTimes(result.blockedSlots.map((s) => s.time.slice(0, 5)));
        setBoothCount(result.boothCount);
        setSlotUsage(new Map(result.slotUsage.map((s) => [s.time, s.count])));
        setDateHoursState({
          openingTime: result.openingTime,
          closingTime: result.closingTime,
          hoursSource: result.hoursSource,
        });
        setRangeFrom(timeSlots[0] ?? "");
        setRangeTo(timeSlots[timeSlots.length - 1] ?? "");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    loadAvailability();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, dayIsClosed]);

  function refreshAfterAction() {
    router.refresh();
  }

  function getSlotBookingCount(time: string): number {
    return slotUsage.get(time) ?? 0;
  }

  function slotUsageLabel(time: string): string {
    const count = getSlotBookingCount(time);
    const label = formatTimeLabel(time);
    if (count === 0) return label;
    return `${label} (${count}/${boothCount} hr)`;
  }

  async function handleSetBoothCapacity() {
    const startDate = boothDuration === "hours" ? selected : boothStartDate;
    if (!startDate) return;
    if (boothDuration === "hours" && boothHourStart >= boothHourEnd) {
      setBoothError("Start time must be before end time.");
      return;
    }
    setSavingBooths(true);
    setBoothError(null);
    try {
      await setBoothCapacity(
        startDate,
        boothInputCount,
        boothDuration === "hours" ? "day" : boothDuration,
        boothDuration === "hours" ? { startTime: boothHourStart, endTime: boothHourEnd } : undefined,
      );
      const result = await getDateAvailability(selected);
      setBookedTimes(result.bookedTimes);
      setBoothCount(result.boothCount);
      setSlotUsage(new Map(result.slotUsage.map((s) => [s.time, s.count])));
      setActiveOp(null);
      refreshAfterAction();
      showToast("Booth capacity updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setBoothError(message);
      showToast(message, "error");
    } finally {
      setSavingBooths(false);
    }
  }

  async function handleSetHours() {
    if (!hoursStart || !hoursEnd) return;
    setSavingHours(true);
    try {
      await setDateHours(selected, hoursStart, hoursEnd);
      setDateHoursState({ openingTime: hoursStart, closingTime: hoursEnd, hoursSource: "date" });
      setActiveOp(null);
      refreshAfterAction();
      showToast("Hours saved for this day.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSavingHours(false);
    }
  }

  async function handleClearHours() {
    setSavingHours(true);
    try {
      await clearDateHours(selected);
      const result = await getDateAvailability(selected);
      setDateHoursState({
        openingTime: result.openingTime,
        closingTime: result.closingTime,
        hoursSource: result.hoursSource,
      });
      setActiveOp(null);
      refreshAfterAction();
      showToast("Hours reset to default.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSavingHours(false);
    }
  }

  async function reloadSelectedHours() {
    const result = await getDateAvailability(selected);
    setDateHoursState({
      openingTime: result.openingTime,
      closingTime: result.closingTime,
      hoursSource: result.hoursSource,
    });
  }

  async function handleSetWeeklyHours() {
    if (!weeklyStart || !weeklyEnd) return;
    setSavingWeekly(true);
    setWeeklyError(null);
    try {
      await setWeekdayHours(weeklyDay, weeklyStart, weeklyEnd);
      await reloadSelectedHours();
      refreshAfterAction();
      showToast(`${WEEKDAY_FULL_NAMES[weeklyDay]} hours saved.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setWeeklyError(message);
      showToast(message, "error");
    } finally {
      setSavingWeekly(false);
    }
  }

  async function handleClearWeeklyHours() {
    setSavingWeekly(true);
    setWeeklyError(null);
    try {
      await clearWeekdayHours(weeklyDay);
      await reloadSelectedHours();
      refreshAfterAction();
      showToast(`${WEEKDAY_FULL_NAMES[weeklyDay]} hours reset to default.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setWeeklyError(message);
      showToast(message, "error");
    } finally {
      setSavingWeekly(false);
    }
  }

  async function handleToggleDay() {
    setSaving(true);
    try {
      const wasClosed = blockedByDate.has(selected);
      if (wasClosed) {
        await unblockDate(selected);
      } else {
        await blockDate(selected, reason);
      }
      setReason("");
      setActiveOp(null);
      refreshAfterAction();
      showToast(wasClosed ? "Day marked available." : "Day marked closed.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSlot(time: string) {
    setSavingSlot(time);
    try {
      if (blockedTimes.includes(time)) {
        await unblockSlot(selected, `${time}:00`);
        setBlockedTimes((prev) => prev.filter((t) => t !== time));
      } else {
        await blockSlot(selected, `${time}:00`, "");
        setBlockedTimes((prev) => [...prev, time]);
      }
      refreshAfterAction();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSavingSlot(null);
    }
  }

  async function handleBlockRange() {
    const [lo, hi] = rangeFrom <= rangeTo ? [rangeFrom, rangeTo] : [rangeTo, rangeFrom];
    const timesToBlock = timeSlots.filter(
      (t) => t >= lo && t <= hi && !bookedTimes.includes(t) && !blockedTimes.includes(t),
    );
    if (timesToBlock.length === 0) return;
    setSavingRange(true);
    try {
      await blockSlots(
        selected,
        timesToBlock.map((t) => `${t}:00`),
        "",
      );
      setBlockedTimes((prev) => [...prev, ...timesToBlock]);
      refreshAfterAction();
      showToast(`Blocked ${timesToBlock.length} time slot${timesToBlock.length === 1 ? "" : "s"}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSavingRange(false);
    }
  }

  function openBooths() {
    setBoothStartDate(selected);
    setActiveOp(activeOp === "booths" ? null : "booths");
  }

  function openHours() {
    if (activeOp !== "hours") {
      setHoursStart(dateHours.openingTime);
      setHoursEnd(dateHours.closingTime);
    }
    setActiveOp(activeOp === "hours" ? null : "hours");
  }

  function openWeekly() {
    if (activeOp !== "weekly") {
      const rule = weekdayHoursByDay.get(weeklyDay);
      setWeeklyStart(rule?.opening_time ?? defaultOpening);
      setWeeklyEnd(rule?.closing_time ?? defaultClosing);
      setWeeklyError(null);
    }
    setActiveOp(activeOp === "weekly" ? null : "weekly");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
        <input
          type="date"
          value={selected}
          min={toDateKey(today)}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <p className="mt-1 text-sm text-gray-500">
          {formatDateLong(selected)} —{" "}
          {dayIsClosed
            ? `Closed${blockedByDate.get(selected)?.reason ? ` — ${blockedByDate.get(selected)?.reason}` : ""}`
            : `Open ${formatTimeLabel(dateHours.openingTime)}–${formatTimeLabel(dateHours.closingTime)}${dateHours.hoursSource === "default" ? "" : hoursSourceLabel(dateHours.hoursSource, selected)} · ${boothCount} booking${boothCount === 1 ? "" : "s"} allowed per hour`}
        </p>
      </div>

      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white px-4">
        <div className="py-3">
          <button
            type="button"
            onClick={openBooths}
            className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700"
          >
            <span>Set Capacity</span>
            <ChevronIcon open={activeOp === "booths"} />
          </button>
          {activeOp === "booths" && (
            <div className="mt-3  space-y-3">
              <p className="text-xs text-gray-500">
                Set how many bookings can run in the same clock hour (e.g. 9:00 and 9:30
                share one pool). Currently <strong>{boothCount}</strong> per hour on this
                date.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Max Number of Bookings in 1 Hour
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={boothInputCount}
                  onChange={(e) => {
                    setBoothError(null);
                    setBoothInputCount(Math.max(1, Number(e.target.value) || 1));
                  }}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Apply for</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      ["hours", "Custom Hours"],
                      ["day", "1 Day"],
                      ["week", "1 Week"],
                      ["month", "1 Month"],
                      ["ongoing", "Ongoing"],
                      
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setBoothError(null);
                        setBoothDuration(value);
                      }}
                      className={`rounded-md border px-1 py-1.5 text-xs font-medium ${
                        boothDuration === value
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-gray-300 text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {boothDuration === "hours" ? (
                <p className="text-xs text-gray-500">
                  Applies on <strong>{formatDateLong(selected)}</strong> only, between the times
                  below.
                </p>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {boothDuration === "day" ? "Select day" : "Start date"}
                  </label>
                  <input
                    type="date"
                    value={boothStartDate}
                    min={toDateKey(today)}
                    onChange={(e) => {
                      setBoothError(null);
                      setBoothStartDate(e.target.value);
                    }}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {boothDuration === "day" ? (
                      <>
                        Applies on <strong>{formatDateLong(boothStartDate)}</strong> only
                      </>
                    ) : isOngoingBoothPeriod(boothDuration) ? (
                      <>
                        From <strong>{formatDateLong(boothStartDate)}</strong> onward — no end date
                      </>
                    ) : (
                      <>
                        From <strong>{formatDateLong(boothStartDate)}</strong> until{" "}
                        <strong>{formatDateLong(boothPeriodEndDate(boothStartDate, boothDuration))}</strong>
                      </>
                    )}
                  </p>
                </div>
              )}
              {boothDuration === "hours" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Start time</label>
                    <input
                      type="time"
                      value={boothHourStart}
                      onChange={(e) => {
                        setBoothError(null);
                        setBoothHourStart(e.target.value);
                      }}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">End time</label>
                    <input
                      type="time"
                      value={boothHourEnd}
                      onChange={(e) => {
                        setBoothError(null);
                        setBoothHourEnd(e.target.value);
                      }}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  {boothHourStart >= boothHourEnd && (
                    <p className="col-span-2 text-xs text-red-600">Start time must be before end time.</p>
                  )}
                </div>
              )}
              {boothError && <p className="text-sm text-red-600">{boothError}</p>}
              <button
                type="button"
                onClick={handleSetBoothCapacity}
                disabled={
                  savingBooths ||
                  (boothDuration === "hours" ? boothHourStart >= boothHourEnd : !boothStartDate)
                }
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {savingBooths ? "Saving..." : "Apply Capacity"}
              </button>
            </div>
          )}
        </div>

        <div className="py-3">
          <button
            type="button"
            onClick={openHours}
            className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700"
          >
            <span>Business Hours</span>
            <ChevronIcon open={activeOp === "hours"} />
          </button>
          {activeOp === "hours" && (
            <div className="mt-3  space-y-3">
              <p className="text-xs text-gray-500">
                Time slots on this date will start at the opening time and end at the
                closing time you set below. Currently{" "}
                <strong>{formatTimeLabel(dateHours.openingTime)}</strong> –{" "}
                <strong>{formatTimeLabel(dateHours.closingTime)}</strong>
                {hoursSourceLabel(dateHours.hoursSource, selected)}.
              </p>
              {dateHours.hoursSource === "weekday" && (
                <p className="text-xs text-gray-500">
                  Saving here overrides the {WEEKDAY_FULL_NAMES[weekdayOfDateKey(selected)]}{" "}
                  weekly hours for this one date only.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Start time</label>
                  <input
                    type="time"
                    value={hoursStart}
                    onChange={(e) => setHoursStart(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">End time</label>
                  <input
                    type="time"
                    value={hoursEnd}
                    onChange={(e) => setHoursEnd(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSetHours}
                  disabled={savingHours || !hoursStart || !hoursEnd || hoursStart >= hoursEnd}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingHours ? "Saving..." : "Save Hours for This Day"}
                </button>
                {dateHours.hoursSource === "date" && (
                  <button
                    type="button"
                    onClick={handleClearHours}
                    disabled={savingHours}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-50"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
              {hoursStart >= hoursEnd && hoursStart && hoursEnd && (
                <p className="text-xs text-red-600">Start time must be before end time.</p>
              )}
            </div>
          )}
        </div>

        <div className="py-3">
          <button
            type="button"
            onClick={() => setActiveOp(activeOp === "close" ? null : "close")}
            className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700"
          >
            <span>{dayIsClosed ? "Mark Day as Available" : "Mark Day Closed"}</span>
            <ChevronIcon open={activeOp === "close"} />
          </button>
          {activeOp === "close" && (
            <div className="mt-3 ">
              {!dayIsClosed && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleToggleDay}
                  disabled={saving}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : dayIsClosed
                      ? "Confirm: Mark as Available"
                      : "Confirm: Mark as Closed"}
                </button>
                <button
                  onClick={() => setActiveOp(null)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="py-3">
          <button
            type="button"
            onClick={() => setActiveOp(activeOp === "slots" ? null : "slots")}
            disabled={dayIsClosed}
            className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>Block Time Slots</span>
            <ChevronIcon open={activeOp === "slots"} />
          </button>
          {activeOp === "slots" && !dayIsClosed && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-gray-700">Block a range of hours:</p>
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">From</label>
                  <select
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700"
                  >
                    {timeSlots.map((t) => (
                      <option key={t} value={t}>
                        {formatTimeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">To</label>
                  <select
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-700"
                  >
                    {timeSlots.map((t) => (
                      <option key={t} value={t}>
                        {formatTimeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleBlockRange}
                  disabled={savingRange || loadingSlots}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingRange ? "Blocking..." : "Block this range"}
                </button>
              </div>

              <p className="mb-2 text-xs font-medium text-gray-700">
                Or block individual time slots on this day:
              </p>
              {loadingSlots ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {timeSlots.map((t) => {
                    const count = getSlotBookingCount(t);
                    const full = bookedTimes.includes(t);
                    const blocked = blockedTimes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={full || savingSlot === t}
                        onClick={() => handleToggleSlot(t)}
                        style={blocked ? unavailableDateStyle : undefined}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          full
                            ? "cursor-not-allowed border-blue-200 bg-blue-50 text-blue-600"
                            : blocked
                              ? "border-red-200 text-red-600 hover:border-red-300"
                              : count > 0
                                ? "border-blue-200 bg-blue-50/50 text-blue-700 hover:border-blue-300"
                                : "border-gray-300 text-gray-600 hover:border-brand-300 hover:text-brand-700"
                        }`}
                      >
                        {slotUsageLabel(t)}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded border border-blue-200 bg-blue-50" /> Booked
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded border border-red-200" style={unavailableDateStyle} /> Blocked
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded border border-gray-300" /> Available
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="py-3">
          <button
            type="button"
            onClick={openWeekly}
            className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700"
          >
            <span>Weekly Hours</span>
            <ChevronIcon open={activeOp === "weekly"} />
          </button>
          {activeOp === "weekly" && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">
                Recurring hours per day of the week — e.g. Monday to Saturday 9:00
                AM–5:00 PM but Sunday 10:00 AM–4:00 PM. Applies to every matching date.
                Hours set on an individual date still win over this.
              </p>

              <div className="space-y-1">
                {WEEKDAY_FULL_NAMES.map((name, day) => {
                  const rule = weekdayHoursByDay.get(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setWeeklyDay(day);
                        setWeeklyStart(rule?.opening_time ?? defaultOpening);
                        setWeeklyEnd(rule?.closing_time ?? defaultClosing);
                        setWeeklyError(null);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs ${
                        weeklyDay === day
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <span className="font-medium">{name}</span>
                      <span className={rule ? "" : "text-gray-400"}>
                        {rule
                          ? `${formatTimeLabel(rule.opening_time)} – ${formatTimeLabel(rule.closing_time)}`
                          : `${formatTimeLabel(defaultOpening)} – ${formatTimeLabel(defaultClosing)} (default)`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Start time</label>
                  <input
                    type="time"
                    value={weeklyStart}
                    onChange={(e) => {
                      setWeeklyError(null);
                      setWeeklyStart(e.target.value);
                    }}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">End time</label>
                  <input
                    type="time"
                    value={weeklyEnd}
                    onChange={(e) => {
                      setWeeklyError(null);
                      setWeeklyEnd(e.target.value);
                    }}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              {weeklyStart && weeklyEnd && weeklyStart >= weeklyEnd && (
                <p className="text-xs text-red-600">Start time must be before end time.</p>
              )}
              {weeklyError && <p className="text-sm text-red-600">{weeklyError}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSetWeeklyHours}
                  disabled={savingWeekly || !weeklyStart || !weeklyEnd || weeklyStart >= weeklyEnd}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingWeekly ? "Saving..." : `Save ${WEEKDAY_FULL_NAMES[weeklyDay]} Hours`}
                </button>
                {weekdayHoursByDay.has(weeklyDay) && (
                  <button
                    type="button"
                    onClick={handleClearWeeklyHours}
                    disabled={savingWeekly}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-50"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
