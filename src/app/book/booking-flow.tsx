"use client";

import { useMemo, useState } from "react";
import type {
  AddOn,
  BlockedDate,
  BusinessSettings,
  CategoryRow,
  Extra,
  Service,
  ServiceCategory,
  VehicleType,
  VehicleTypeRow,
} from "@/lib/types";
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
  countBookingsByEmail,
  createCheckoutSession,
  getBookedTimes,
  getDateHours,
  type BookedTime,
} from "./actions";

const BOOKING_LIMIT = 5;

type Step = 1 | 2 | 3;

export default function BookingFlow({
  services,
  inclusions,
  extras,
  vehicleTypes,
  categories,
  settings,
  blockedDates,
  paymentConfigured,
}: {
  services: Service[];
  inclusions: AddOn[];
  extras: Extra[];
  vehicleTypes: VehicleTypeRow[];
  categories: CategoryRow[];
  settings: BusinessSettings;
  blockedDates: BlockedDate[];
  paymentConfigured: boolean;
}) {
  const [step, setStep] = useState<Step>(1);
  const [vehicle, setVehicle] = useState<VehicleType>(vehicleTypes[0]?.slug ?? "");
  const [category, setCategory] = useState<ServiceCategory>(categories[0]?.slug ?? "");
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<BookedTime[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timesError, setTimesError] = useState<string | null>(null);
  const [businessHours, setBusinessHours] = useState<{
    openingTime: string;
    closingTime: string;
  } | null>(null);

  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitConfirmCount, setLimitConfirmCount] = useState<number | null>(null);

  const today = useMemo(() => startOfToday(), []);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const blockedByDate = useMemo(() => {
    const map = new Map<string, string | null>();
    blockedDates.forEach((b) => map.set(b.date, b.reason));
    return map;
  }, [blockedDates]);

  const weeks = useMemo(() => getMonthGrid(cursor.year, cursor.month), [cursor]);

  const tierServices = services.filter(
    (s) => s.vehicle_type === vehicle && s.category === category,
  );
  const categoryInclusions = inclusions
    .filter((i) => i.category === category && i.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  function hasInclusion(service: Service, inclusionId: string) {
    return (
      service.service_inclusions?.some((si) => si.inclusion_id === inclusionId) ??
      false
    );
  }

  function toggleExtra(id: string) {
    setSelectedExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const selectedExtras = extras.filter((e) => selectedExtraIds.includes(e.id));
  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const totalPrice = (selectedService?.price ?? 0) + extrasTotal;

  function handleSelectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setSelectedTime(null);
    setTimesError(null);
    setLoadingTimes(true);
    Promise.all([getBookedTimes(dateKey), getDateHours(dateKey)])
      .then(([times, hours]) => {
        setBookedTimes(times);
        setBusinessHours(hours);
      })
      .catch((err) => {
        setBookedTimes([]);
        setTimesError(
          err instanceof Error
            ? err.message
            : "Couldn't load availability for this date. Please try again.",
        );
      })
      .finally(() => setLoadingTimes(false));
  }

  const timeSlots = useMemo(
    () =>
      generateTimeSlots(
        businessHours?.openingTime ?? settings.opening_time,
        businessHours?.closingTime ?? settings.closing_time,
        settings.slot_interval_minutes,
      ),
    [businessHours, settings],
  );

  function changeMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  async function handleConfirm() {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      const existingCount = await countBookingsByEmail(email);
      if (existingCount >= BOOKING_LIMIT) {
        setLimitConfirmCount(existingCount);
        setSubmitting(false);
        return;
      }
      await submitBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  async function submitBooking() {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      const { url } = await createCheckoutSession({
        service_id: selectedService.id,
        booking_date: selectedDate,
        booking_time: `${selectedTime}:00`,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        extra_ids: selectedExtraIds,
      });
      window.location.href = url;
      // Intentionally leave `submitting` true — the page is navigating away.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-center gap-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step >= n ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {n}
            </div>
            {n < 3 && (
              <div
                className={`h-px w-10 ${step > n ? "bg-brand-600" : "bg-gray-300"}`}
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Select Vehicle &amp; Service
          </h2>

          <p className="mb-2 text-sm font-medium text-gray-700">Select Vehicle:</p>
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {vehicleTypes.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setVehicle(v.slug);
                  setSelectedService(null);
                }}
                className={`rounded-md border py-3 text-sm font-medium ${
                  vehicle === v.slug
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>

          <p className="mb-2 text-sm font-medium text-gray-700">Select Service:</p>
          <div className="mb-6 grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCategory(c.slug);
                  setSelectedService(null);
                }}
                className={`rounded-md border py-3 text-sm font-medium ${
                  category === c.slug
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                {c.name} Service
              </button>
            ))}
          </div>

          {tierServices.length === 0 ? (
            <p className="text-sm text-gray-400">
              No services configured for this combination yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-1/3" />
                    {tierServices.map((s) => (
                      <th
                        key={s.id}
                        className="border-l border-gray-100 p-0 text-center align-top"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedService(s)}
                          className="flex w-full flex-col items-center gap-1 p-3"
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                              selectedService?.id === s.id
                                ? "border-brand-600"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedService?.id === s.id && (
                              <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                            )}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {s.name}
                          </span>
                          <span className="font-bold text-brand-600">
                            ${s.price.toFixed(2)}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryInclusions.map((inc, i) => (
                    <tr key={inc.id} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="p-2 pl-3 text-xs text-gray-600">
                        {inc.name}
                      </td>
                      {tierServices.map((s) => (
                        <td
                          key={s.id}
                          className="border-l border-gray-100 p-2 text-center"
                        >
                          {hasInclusion(s, inc.id) ? (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-white">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            </span>
                          ) : (
                            <span className="inline-block h-2 w-2 rounded-full bg-gray-200" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Choose Your Date &amp; Time
            </h2>

            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="rounded-lg border border-gray-200 p-4 md:flex-1">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="px-2 text-gray-500"
                  >
                    «
                  </button>
                  <span className="font-medium">
                    {MONTH_NAMES[cursor.month]} {cursor.year}
                  </span>
                  <button
                    onClick={() => changeMonth(1)}
                    className="px-2 text-gray-500"
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
                    const isPast = date < today;
                    const isBlocked = blockedByDate.has(key);
                    const disabled = isPast || isBlocked || !inMonth;

                    const isUnavailable = isPast || isBlocked;

                    return (
                      <button
                        key={key}
                        disabled={disabled}
                        onClick={() => handleSelectDate(key)}
                        title={isBlocked ? blockedByDate.get(key) || "Not available" : undefined}
                        style={
                          isUnavailable && inMonth ? unavailableDateStyle : undefined
                        }
                        className={`aspect-square rounded text-sm ${
                          !inMonth ? "text-gray-300" : ""
                        } ${
                          disabled && inMonth
                            ? "cursor-not-allowed text-gray-400"
                            : "hover:bg-gray-100"
                        } ${selectedDate === key ? "bg-brand-600 text-white hover:bg-brand-600" : ""}`}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4 md:w-64 md:flex-none">
                {selectedDate ? (
                  <>
                    <h3 className="mb-3 text-sm font-medium text-gray-700">
                      Available times on {selectedDate}
                    </h3>
                    {loadingTimes ? (
                      <p className="text-sm text-gray-400">Loading...</p>
                    ) : timesError ? (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {timesError}
                        <button
                          type="button"
                          onClick={() => handleSelectDate(selectedDate)}
                          className="mt-2 block font-medium underline"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {timeSlots.map((t) => {
                          const bookedEntry = bookedTimes.find((bt) => bt.time === t);
                          const taken = Boolean(bookedEntry);
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
                  </>
                ) : (
                  <p className="text-sm text-gray-400">
                    Select a date to see available times.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              disabled={
                !selectedService || !selectedDate || !selectedTime || Boolean(timesError)
              }
              onClick={() => setStep(2)}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            Optional Add-ons
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Add any extra services to {selectedService?.name ?? "your booking"}.
          </p>

          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {extras.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">
                No add-ons available right now.
              </p>
            ) : (
              extras.map((extra) => {
                const checked = selectedExtraIds.includes(extra.id);
                return (
                  <label
                    key={extra.id}
                    className="flex cursor-pointer items-start justify-between gap-4 p-4 hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{extra.name}</p>
                      {extra.description && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {extra.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-semibold text-brand-600">
                        ${extra.price.toFixed(2)}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExtra(extra.id)}
                        className="h-4 w-4 accent-brand-600"
                      />
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-md bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-600">Estimated total</span>
            <span className="font-semibold text-gray-900">
              ${totalPrice.toFixed(2)}
            </span>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-600"
            >
              Previous
            </button>
            <button
              onClick={() => setStep(3)}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Details</h2>

          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            <div>
              {selectedService?.name} (
              {vehicleTypes.find((v) => v.slug === vehicle)?.name ?? vehicle}) — $
              {selectedService?.price.toFixed(2)}
            </div>
            {selectedExtras.length > 0 && (
              <div className="mt-1">
                {selectedExtras.map((extra) => (
                  <div key={extra.id} className="flex justify-between text-xs">
                    <span>+ {extra.name}</span>
                    <span>${extra.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1 flex justify-between font-medium text-gray-900">
              <span>Total</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="mt-1">
              {selectedDate} at {selectedTime && formatTimeLabel(selectedTime)}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {paymentConfigured ? (
            <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Pay securely with Stripe
              </p>
              <p className="mt-1 text-sm text-blue-700">
                You&apos;ll be taken to Stripe&apos;s secure checkout to pay{" "}
                <strong>${totalPrice.toFixed(2)}</strong> by card. Your slot is
                held for you while you pay — if payment doesn&apos;t go through,
                it&apos;s automatically released.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Online payment isn&apos;t available right now
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Please call us to complete this booking — we&apos;re sorry for the
                inconvenience.
              </p>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-600"
            >
              Previous
            </button>
            <button
              disabled={!name || !phone || !email || submitting || !paymentConfigured}
              onClick={handleConfirm}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {submitting
                ? "Redirecting to Stripe..."
                : `Continue to Payment — $${totalPrice.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {limitConfirmCount !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">
              Booking limit reached
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This email has already been used for {limitConfirmCount} bookings.
              Do you still want to continue with this booking?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setLimitConfirmCount(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setLimitConfirmCount(null);
                  submitBooking();
                }}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Yes, continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
