"use client";

import { useEffect, useMemo, useState } from "react";
import type { BlockedDate, Booking, BusinessSettings } from "@/lib/types";
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
import { getBookedTimes, getDateHours, type BookedTime } from "@/app/book/actions";

export default function RescheduleModal({
  booking,
  settings,
  blockedDates,
  bookingCountByDate,
  onConfirm,
  onClose,
}: {
  booking: Booking;
  settings: BusinessSettings;
  blockedDates: BlockedDate[];
  bookingCountByDate: Record<string, number>;
  onConfirm: (date: string, time: string) => Promise<void>;
  onClose: () => void;
}) {
  const today = useMemo(() => startOfToday(), []);
  const [cursor, setCursor] = useState(() => {
    const [y, m] = booking.booking_date.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedDate, setSelectedDate] = useState(booking.booking_date);
  const [selectedTime, setSelectedTime] = useState<string | null>(
    booking.booking_time.slice(0, 5),
  );
  const [bookedTimes, setBookedTimes] = useState<BookedTime[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessHours, setBusinessHours] = useState<{
    openingTime: string;
    closingTime: string;
  } | null>(null);

  const blockedByDate = useMemo(() => {
    const map = new Map<string, string | null>();
    blockedDates.forEach((b) => map.set(b.date, b.reason));
    return map;
  }, [blockedDates]);
  const weeks = useMemo(() => getMonthGrid(cursor.year, cursor.month), [cursor]);
  const timeSlots = useMemo(
    () =>
      generateTimeSlots(
        businessHours?.openingTime ?? settings.opening_time,
        businessHours?.closingTime ?? settings.closing_time,
        settings.slot_interval_minutes,
      ),
    [businessHours, settings],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadAvailability() {
      setLoadingTimes(true);
      try {
        const [times, hours] = await Promise.all([
          getBookedTimes(selectedDate),
          getDateHours(selectedDate),
        ]);
        if (!cancelled) {
          setBookedTimes(times);
          setBusinessHours(hours);
        }
      } finally {
        if (!cancelled) setLoadingTimes(false);
      }
    }
    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  function changeMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function handleSelectDate(key: string) {
    setSelectedDate(key);
    setSelectedTime(null);
  }

  async function handleConfirm() {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedDate, `${selectedTime}:00`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Reschedule Booking
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {booking.customer_name} · {booking.services?.name ?? "Service"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6 18 18M6 18 18 6" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="rounded-lg border border-gray-200 p-3 sm:flex-1">
              <div className="mb-2 flex items-center justify-between">
                <button
                  onClick={() => changeMonth(-1)}
                  className="px-2 text-gray-500"
                >
                  «
                </button>
                <span className="text-sm font-medium">
                  {MONTH_NAMES[cursor.month]} {cursor.year}
                </span>
                <button onClick={() => changeMonth(1)} className="px-2 text-gray-500">
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
                  const isPast = date < today;
                  const isBlocked = blockedByDate.has(key);
                  const disabled = isPast || isBlocked || !inMonth;
                  const isUnavailable = isPast || isBlocked;
                  const bookingCount = bookingCountByDate[key] ?? 0;
                  const isSelected = selectedDate === key;

                  return (
                    <button
                      key={key}
                      disabled={disabled}
                      onClick={() => handleSelectDate(key)}
                      title={
                        isBlocked
                          ? blockedByDate.get(key) || "Not available"
                          : bookingCount > 0
                            ? `${bookingCount} booking${bookingCount > 1 ? "s" : ""} already on this day`
                            : undefined
                      }
                      style={
                        isUnavailable && inMonth ? unavailableDateStyle : undefined
                      }
                      className={`relative aspect-square rounded text-sm ${
                        !inMonth ? "text-gray-300" : ""
                      } ${
                        disabled && inMonth
                          ? "cursor-not-allowed text-gray-400"
                          : "hover:bg-gray-100"
                      } ${isSelected ? "bg-brand-600 text-white hover:bg-brand-600" : ""}`}
                    >
                      {date.getDate()}
                      {!isBlocked && inMonth && bookingCount > 0 && (
                        <span
                          className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                            isSelected ? "bg-white" : "bg-brand-500"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Has
                existing booking(s)
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 sm:w-56 sm:flex-none">
              <h3 className="mb-2 text-xs font-medium text-gray-700">
                Available times on {selectedDate}
              </h3>
              {loadingTimes ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map((t) => {
                    const isOwnCurrentSlot =
                      selectedDate === booking.booking_date &&
                      t === booking.booking_time.slice(0, 5);
                    const bookedEntry = bookedTimes.find((bt) => bt.time === t);
                    const taken = Boolean(bookedEntry) && !isOwnCurrentSlot;
                    const blocked = bookedEntry?.isBlocked ?? false;
                    return (
                      <button
                        key={t}
                        disabled={taken}
                        onClick={() => setSelectedTime(t)}
                        title={
                          taken
                            ? bookedEntry?.reason ||
                              (blocked ? "Not available" : "Already booked")
                            : undefined
                        }
                        style={blocked ? unavailableDateStyle : undefined}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          taken
                            ? blocked
                              ? "cursor-not-allowed border-red-200 text-red-600"
                              : "cursor-not-allowed border-blue-200 bg-blue-50 text-blue-600"
                            : selectedTime === t
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
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600"
          >
            Cancel
          </button>
          <button
            disabled={!selectedDate || !selectedTime || submitting}
            onClick={handleConfirm}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {submitting ? "Rescheduling..." : "Confirm Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
