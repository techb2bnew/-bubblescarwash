"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockedDate, BusinessSettings, Service } from "@/lib/types";
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
  blockSlots,
  createBookingAdmin,
  getDateAvailability,
  unblockDate,
  unblockSlot,
} from "./actions";

type ActiveAction = "close" | "slots" | "booking" | null;

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
}: {
  blockedDates: BlockedDate[];
  settings: BusinessSettings;
  services: Service[];
}) {
  const router = useRouter();
  const today = useMemo(() => startOfToday(), []);
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
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [savingRange, setSavingRange] = useState(false);

  const [bookingServiceId, setBookingServiceId] = useState("");
  const [bookingTime, setBookingTime] = useState<string | null>(null);
  const [bookingName, setBookingName] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
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
      setBookingError(null);
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
      setActiveAction(null);
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
      router.refresh();
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
      });
      setBookedTimes((prev) => [...prev, bookingTime]);
      setBookingServiceId("");
      setBookingTime(null);
      setBookingName("");
      setBookingPhone("");
      setBookingEmail("");
      setActiveAction(null);
      router.refresh();
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBookingSubmitting(false);
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
          <p className="text-base font-semibold text-gray-900">
            {formatDateLong(selected)} — Availability
          </p>
          <p className="mt-0.5 text-sm text-gray-500">
            {dayIsClosed
              ? `Closed${blockedByDate.get(selected)?.reason ? ` — ${blockedByDate.get(selected)?.reason}` : ""}`
              : "Open for bookings"}
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
                            const taken =
                              bookedTimes.includes(t) || blockedTimes.includes(t);
                            return (
                              <button
                                key={t}
                                type="button"
                                disabled={taken}
                                onClick={() => setBookingTime(t)}
                                className={`rounded-md border px-2 py-1.5 text-xs ${
                                  taken
                                    ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                    : bookingTime === t
                                      ? "border-brand-600 bg-brand-50 text-brand-700"
                                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                                }`}
                              >
                                {formatTimeLabel(t)}
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
        </div>
      )}
    </div>
  );
}
