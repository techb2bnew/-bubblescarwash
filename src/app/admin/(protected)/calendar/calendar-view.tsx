"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  BlockedDate,
  BusinessSettings,
  Customer,
  Extra,
  HoursSource,
  Service,
  ServiceCategoryRow,
  VehicleTypeRow,
} from "@/lib/types";
import type { PaymentMode } from "@/lib/payment-mode";
import {
  formatDateLong,
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
import { getDateAvailability } from "./actions";
import CreateBookingWizard from "./create-booking-wizard";
import { getBookingPaymentStatus, cancelUnpaidBooking } from "@/app/book/actions";

export default function CalendarView({
  blockedDates,
  settings,
  services,
  vehicleTypes,
  customers,
  extras,
  categories,
  googleCalendarEmbedUrl,
  paymentMode,
}: {
  blockedDates: BlockedDate[];
  settings: BusinessSettings;
  services: Service[];
  vehicleTypes: VehicleTypeRow[];
  customers: Pick<Customer, "id" | "name" | "phone" | "email">[];
  extras: Extra[];
  categories: ServiceCategoryRow[];
  googleCalendarEmbedUrl: string | null;
  paymentMode: PaymentMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = useMemo(() => startOfToday(), []);
  const useGoogleCalendar = Boolean(googleCalendarEmbedUrl);
  const [calendarKey, setCalendarKey] = useState(0);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(() => toDateKey(today));

  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<string[]>([]);
  const [boothCount, setBoothCount] = useState(1);
  const [slotUsage, setSlotUsage] = useState<Map<string, number>>(new Map());
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [dateHours, setDateHoursState] = useState<{
    openingTime: string;
    closingTime: string;
    hoursSource: HoursSource;
  }>({
    openingTime: settings.opening_time.slice(0, 5),
    closingTime: settings.closing_time.slice(0, 5),
    hoursSource: "default",
  });

  const [stripeBanner, setStripeBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const blockedByDate = useMemo(() => {
    const map = new Map<string, BlockedDate>();
    blockedDates.forEach((b) => map.set(b.date, b));
    return map;
  }, [blockedDates]);

  const weeks = useMemo(() => getMonthGrid(cursor.year, cursor.month), [cursor]);

  const timeSlots = useMemo(
    () => generateTimeSlots(dateHours.openingTime, dateHours.closingTime, settings.slot_interval_minutes),
    [dateHours, settings.slot_interval_minutes],
  );

  const dayIsClosed = selected ? blockedByDate.has(selected) : false;

  /** Handles the return trip from an admin-initiated Stripe checkout redirect. */
  useEffect(() => {
    const bookingId = searchParams.get("booking_id");
    if (!bookingId) return;

    if (searchParams.get("stripe_cancelled")) {
      cancelUnpaidBooking(bookingId);
      queueMicrotask(() => {
        setStripeBanner({ ok: false, text: "Payment was cancelled — the slot has been released." });
      });
      router.replace("/admin/calendar");
    } else if (searchParams.get("stripe_success")) {
      getBookingPaymentStatus(bookingId).then((status) => {
        setStripeBanner(
          status?.paymentStatus === "paid"
            ? { ok: true, text: `Payment confirmed for ${status.customerName}.` }
            : { ok: true, text: "Payment received — waiting for confirmation." },
        );
      });
      router.replace("/admin/calendar");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
        setDateHoursState({
          openingTime: result.openingTime,
          closingTime: result.closingTime,
          hoursSource: result.hoursSource,
        });
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

  return (
    <>
      {stripeBanner && (
        <div
          className={`mb-4 flex items-center justify-between rounded-md border px-4 py-2.5 text-sm ${
            stripeBanner.ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          <span>{stripeBanner.text}</span>
          <button onClick={() => setStripeBanner(null)} className="text-xs font-medium underline">
            Dismiss
          </button>
        </div>
      )}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {useGoogleCalendar ? (
          <div className="w-full min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
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
              className="block h-[70vh] max-h-[720px] min-h-[320px] w-full rounded-md border-0 sm:min-h-[480px]"
            />
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
                <span className="h-3 w-3 rounded border border-gray-300" style={unavailableDateStyle} /> Closed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded border border-gray-300" /> Available
              </span>
            </div>
          </div>
        )}

        <div className="w-full shrink-0 rounded-lg border border-gray-200 bg-white p-4 lg:w-96">
          {useGoogleCalendar && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">Manage date</label>
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
              <p className="mt-1 text-xs text-gray-500">Pick a date to create a booking.</p>
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
                  : `Open ${formatTimeLabel(dateHours.openingTime)}–${formatTimeLabel(dateHours.closingTime)} · ${boothCount} booking${boothCount === 1 ? "" : "s"} allowed per hour`}
              </p>

              {dayIsClosed ? (
                <p className="mt-4 text-sm text-gray-500">
                  This day is closed.{" "}
                  <Link href="/admin/calendar/set-operations" className="font-medium text-brand-600 hover:underline">
                    Manage this in Set Operations →
                  </Link>
                </p>
              ) : (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <CreateBookingWizard
                    services={services}
                    vehicleTypes={vehicleTypes}
                    customers={customers}
                    extras={extras}
                    categories={categories}
                    bookingDate={selected}
                    timeSlots={timeSlots}
                    bookedTimes={bookedTimes}
                    blockedTimes={blockedTimes}
                    getSlotBookingCount={getSlotBookingCount}
                    slotUsageLabel={slotUsageLabel}
                    loadingSlots={loadingSlots}
                    paymentMode={paymentMode}
                    onBooked={(time) => {
                      setBookedTimes((prev) => [...prev, time]);
                      refreshAfterAction();
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">Select a date to create a booking.</p>
          )}
        </div>
      </div>
    </>
  );
}
