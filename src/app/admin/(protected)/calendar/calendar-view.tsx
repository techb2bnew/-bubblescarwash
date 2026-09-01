"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BlockedDate,
  BookingType,
  BoothCapacityDuration,
  BusinessSettings,
  Service,
} from "@/lib/types";
import {
  boothPeriodEndDate,
  formatTimeLabel,
  generateTimeSlots,
  getMonthGrid,
  isOngoingBoothPeriod,
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
  blockSlots,
  createBookingAdmin,
  getDateAvailability,
  setBoothCapacity,
  unblockDate,
  unblockSlot,
} from "./actions";

type ActiveAction = "close" | "slots" | "booking" | "booths" | null;

function formatDateLong(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

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

export default function CalendarView({
  blockedDates,
  settings,
  services,
  googleCalendarEmbedUrl,
}: {
  blockedDates: BlockedDate[];
  settings: BusinessSettings;
  services: Service[];
  googleCalendarEmbedUrl: string | null;
}) {
  const router = useRouter();
  const today = useMemo(() => startOfToday(), []);
  const useGoogleCalendar = Boolean(googleCalendarEmbedUrl);
  const [calendarKey, setCalendarKey] = useState(0);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(() => toDateKey(today));
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<string[]>([]);
  const [boothCount, setBoothCount] = useState(1);
  const [slotUsage, setSlotUsage] = useState<Map<string, number>>(new Map());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const [boothInputCount, setBoothInputCount] = useState(2);
  const [boothDuration, setBoothDuration] = useState<BoothCapacityDuration>("week");
  const [boothStartDate, setBoothStartDate] = useState(() => toDateKey(today));
  const [savingBooths, setSavingBooths] = useState(false);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [savingRange, setSavingRange] = useState(false);

  const [bookingServiceId, setBookingServiceId] = useState("");
  const [bookingTime, setBookingTime] = useState<string | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingType, setBookingType] = useState<BookingType>("offline");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

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
    function resetForNewDate() {
      setActiveAction(null);
      setReason("");
      setRangeFrom(timeSlots[0] ?? "");
      setRangeTo(timeSlots[timeSlots.length - 1] ?? "");
      setBookingServiceId("");
      setBookingTime(null);
      setBookingName("");
      setBookingPhone("");
      setBookingEmail("");
      setBookingType("offline");
      setBookingError(null);
      if (selected) setBoothStartDate(selected);
    }
    resetForNewDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

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
        setBoothCount(result.boothCount);
        setSlotUsage(new Map(result.slotUsage.map((s) => [s.time, s.count])));
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

  function refreshGoogleCalendar() {
    setCalendarKey((k) => k + 1);
  }

  function refreshAfterAction() {
    refreshGoogleCalendar();
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
    if (!boothStartDate) return;
    setSavingBooths(true);
    try {
      await setBoothCapacity(boothStartDate, boothInputCount, boothDuration);
      if (selected) {
        const result = await getDateAvailability(selected);
        setBookedTimes(result.bookedTimes);
        setBoothCount(result.boothCount);
        setSlotUsage(new Map(result.slotUsage.map((s) => [s.time, s.count])));
      }
      setActiveAction(null);
      refreshAfterAction();
    } finally {
      setSavingBooths(false);
    }
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
      setActiveAction(null);
      refreshAfterAction();
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
      refreshAfterAction();
    } finally {
      setSavingSlot(null);
    }
  }

  async function handleBlockRange() {
    if (!selected) return;
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
    } finally {
      setSavingRange(false);
    }
  }

  async function handleCreateBooking() {
    if (!selected || !bookingServiceId || !bookingTime) return;
    setBookingSubmitting(true);
    setBookingError(null);
    try {
      await createBookingAdmin({
        service_id: bookingServiceId,
        booking_date: selected,
        booking_time: `${bookingTime}:00`,
        customer_name: bookingName,
        customer_phone: bookingPhone,
        customer_email: bookingEmail,
        booking_type: bookingType,
      });
      setBookedTimes((prev) => [...prev, bookingTime]);
      setBookingServiceId("");
      setBookingTime(null);
      setBookingName("");
      setBookingPhone("");
      setBookingEmail("");
      setBookingType("offline");
      setActiveAction(null);
      refreshAfterAction();
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBookingSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-4 xl:flex-row">
      {useGoogleCalendar ? (
        <div className="w-full min-w-0 flex-1 space-y-3 rounded-lg border border-gray-200 bg-white p-3">
          

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-700">Google Calendar</p>
              <button
                type="button"
                onClick={refreshGoogleCalendar}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
            <iframe
              key={calendarKey}
              title="Google Calendar"
              src={googleCalendarEmbedUrl!}
              className="w-full rounded-md border-0"
              style={{ height: "min(65vh, 640px)", minHeight: 420 }}
            />
          </div>
        </div>
      ) : (
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
      )}

      <div className="w-full max-w-md shrink-0 rounded-lg border border-gray-200 bg-white p-4 xl:w-96">
        {useGoogleCalendar && (
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Manage date
            </label>
            <input
              type="date"
              value={selected ?? ""}
              min={toDateKey(today)}
              onChange={(e) => {
                const value = e.target.value || null;
                setSelected(value);
                if (value) {
                  const [y, m] = value.split("-").map(Number);
                  setCursor({ year: y, month: m - 1 });
                }
              }}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Pick a date to block slots, close the day, or create a booking.
            </p>
          </div>
        )}

      {selected ? (
        <>
          <p className="text-base font-semibold text-gray-900">
            {formatDateLong(selected)} — Availability
          </p>
          <p className="mt-0.5 text-sm text-gray-500">
            {dayIsClosed
              ? `Closed${blockedByDate.get(selected)?.reason ? ` — ${blockedByDate.get(selected)?.reason}` : ""}`
              : `Open for bookings · ${boothCount} booking${boothCount === 1 ? "" : "s"} allowed per hour`}
          </p>

          {dayIsClosed ? (
            <button
              onClick={() => handleToggle(selected)}
              disabled={saving}
              className="mt-4 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Updating..." : "Mark Day as Available"}
            </button>
          ) : (
            <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
              <div className="py-3">
                <button
                  type="button"
                  onClick={() => {
                    if (activeAction !== "booths" && selected) {
                      setBoothStartDate(selected);
                    }
                    setActiveAction(activeAction === "booths" ? null : "booths");
                  }}
                  className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700"
                >
                  <span>↳ Set Capacity</span>
                  <ChevronIcon open={activeAction === "booths"} />
                </button>
                {activeAction === "booths" && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-gray-500">
                      Set how many bookings can run in the same clock hour (e.g. 9:00 and
                      9:30 share one pool). Currently <strong>{boothCount}</strong> per hour
                      on this date.
                    </p>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Number of Bookings in 1 Hour
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={boothInputCount}
                        onChange={(e) =>
                          setBoothInputCount(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Apply for
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ["day", "1 Day"],
                            ["week", "1 Week"],
                            ["month", "1 Month"],
                            ["ongoing", "Ongoing"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setBoothDuration(value)}
                            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
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
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        {boothDuration === "day" ? "Select day" : "Start date"}
                      </label>
                      <input
                        type="date"
                        value={boothStartDate}
                        min={toDateKey(today)}
                        onChange={(e) => setBoothStartDate(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {boothDuration === "day" ? (
                          <>
                            Applies on <strong>{formatDateLong(boothStartDate)}</strong> only
                          </>
                        ) : isOngoingBoothPeriod(boothDuration) ? (
                          <>
                            From <strong>{formatDateLong(boothStartDate)}</strong> onward — no end
                            date
                          </>
                        ) : (
                          <>
                            From <strong>{formatDateLong(boothStartDate)}</strong> until{" "}
                            <strong>
                              {formatDateLong(boothPeriodEndDate(boothStartDate, boothDuration))}
                            </strong>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSetBoothCapacity}
                      disabled={savingBooths || !boothStartDate}
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
                  onClick={() =>
                    setActiveAction(activeAction === "close" ? null : "close")
                  }
                  className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700"
                >
                  <span>↳ Mark Day as Closed</span>
                  <ChevronIcon open={activeAction === "close"} />
                </button>
                {activeAction === "close" && (
                  <div className="mt-3">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleToggle(selected)}
                        disabled={saving}
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {saving ? "Closing..." : "Confirm: Mark as Closed"}
                      </button>
                      <button
                        onClick={() => setActiveAction(null)}
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
                  onClick={() =>
                    setActiveAction(activeAction === "slots" ? null : "slots")
                  }
                  className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700"
                >
                  <span>↳ Block Time Slots</span>
                  <ChevronIcon open={activeAction === "slots"} />
                </button>
                {activeAction === "slots" && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium text-gray-700">
                      Block a range of hours:
                    </p>
                    <div className="mb-4 flex flex-wrap items-end gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">
                          From
                        </label>
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
                        <label className="mb-1 block text-xs text-gray-500">
                          To
                        </label>
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
                        <span className="h-3 w-3 rounded border border-blue-200 bg-blue-50" />{" "}
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

              <div className="py-3">
                <button
                  type="button"
                  onClick={() =>
                    setActiveAction(activeAction === "booking" ? null : "booking")
                  }
                  className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-800 hover:text-brand-700"
                >
                  <span>↳ Create New Booking</span>
                  <ChevronIcon open={activeAction === "booking"} />
                </button>
                {activeAction === "booking" && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Booking Type
                      </label>
                      <div className="flex gap-2">
                        {(["offline", "online"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setBookingType(type)}
                            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium capitalize ${
                              bookingType === type
                                ? "border-brand-600 bg-brand-50 text-brand-700"
                                : "border-gray-300 text-gray-600 hover:border-gray-400"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                      {bookingType === "offline" && (
                        <p className="mt-1 text-xs text-gray-500">
                          Offline bookings (phone/walk-in) can use any time slot,
                          even ones marked booked or blocked.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Service
                      </label>
                      <select
                        value={bookingServiceId}
                        onChange={(e) => setBookingServiceId(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Select a service</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — ${s.price.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Customer name
                        </label>
                        <input
                          value={bookingName}
                          onChange={(e) => setBookingName(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Phone
                        </label>
                        <input
                          value={bookingPhone}
                          onChange={(e) => setBookingPhone(e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Email
                      </label>
                      <input
                        type="email"
                        value={bookingEmail}
                        onChange={(e) => setBookingEmail(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Time
                      </label>
                      {loadingSlots ? (
                        <p className="text-sm text-gray-400">Loading...</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {timeSlots.map((t) => {
                            const count = getSlotBookingCount(t);
                            const full = bookedTimes.includes(t);
                            const blocked = blockedTimes.includes(t);
                            const isOffline = bookingType === "offline";
                            const disabled = !isOffline && (full || blocked);
                            return (
                              <button
                                key={t}
                                type="button"
                                disabled={disabled}
                                onClick={() => setBookingTime(t)}
                                style={disabled && blocked ? unavailableDateStyle : undefined}
                                className={`rounded-md border px-2 py-1.5 text-xs ${
                                  disabled
                                    ? full
                                      ? "cursor-not-allowed border-blue-200 bg-blue-50 text-blue-600"
                                      : "cursor-not-allowed border-red-200 text-red-600"
                                    : bookingTime === t
                                      ? "border-brand-600 bg-brand-50 text-brand-700"
                                      : count > 0 && !full
                                        ? "border-blue-200 bg-blue-50/50 text-blue-700 hover:border-blue-300"
                                        : (full || blocked) && isOffline
                                          ? "border-amber-300 text-amber-700 hover:border-amber-400"
                                          : "border-gray-300 text-gray-600 hover:border-gray-400"
                                }`}
                              >
                                {count > 0 ? slotUsageLabel(t) : formatTimeLabel(t)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {bookingError && (
                      <p className="text-sm text-red-600">{bookingError}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateBooking}
                        disabled={
                          !bookingServiceId ||
                          !bookingTime ||
                          !bookingName ||
                          !bookingPhone ||
                          !bookingEmail ||
                          bookingSubmitting
                        }
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
                      >
                        {bookingSubmitting ? "Creating..." : "Create Booking"}
                      </button>
                      <button
                        onClick={() => setActiveAction(null)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Select a date to manage availability and bookings.
        </p>
      )}
      </div>
    </div>
  );
}
