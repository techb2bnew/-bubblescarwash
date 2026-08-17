"use client";

import { useMemo, useState } from "react";
import type {
  AddOn,
  BlockedDate,
  BusinessSettings,
  CategoryRow,
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
import { createBooking, getBookedTimes, type BookedTime } from "./actions";

type Step = 1 | 2 | 3;

const PAYMENT_METHODS = [
  { value: "card", label: "Credit Card / Apple Pay / Google Pay" },
  { value: "afterpay", label: "Afterpay" },
  { value: "zip", label: "Zip Pay" },
];

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return (digits.match(/.{1,4}/g) ?? []).join(" ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function BookingFlow({
  services,
  inclusions,
  vehicleTypes,
  categories,
  settings,
  blockedDates,
}: {
  services: Service[];
  inclusions: AddOn[];
  vehicleTypes: VehicleTypeRow[];
  categories: CategoryRow[];
  settings: BusinessSettings;
  blockedDates: BlockedDate[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [vehicle, setVehicle] = useState<VehicleType>(vehicleTypes[0]?.slug ?? "");
  const [category, setCategory] = useState<ServiceCategory>(categories[0]?.slug ?? "");
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<BookedTime[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].value);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

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

  function handleSelectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setSelectedTime(null);
    setLoadingTimes(true);
    getBookedTimes(dateKey)
      .then(setBookedTimes)
      .finally(() => setLoadingTimes(false));
  }

  const timeSlots = useMemo(
    () =>
      generateTimeSlots(
        settings.opening_time,
        settings.closing_time,
        settings.slot_interval_minutes,
      ),
    [settings],
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
      const result = await createBooking({
        service_id: selectedService.id,
        booking_date: selectedDate,
        booking_time: `${selectedTime}:00`,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
      });
      setConfirmedId(result.id);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-center gap-3">
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step >= n ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {n}
            </div>
            {n < 2 && <div className="h-px w-10 bg-gray-300" />}
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
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {timeSlots.map((t) => {
                          const bookedEntry = bookedTimes.find((bt) => bt.time === t);
                          const taken = Boolean(bookedEntry);
                          return (
                            <button
                              key={t}
                              disabled={taken}
                              onClick={() => setSelectedTime(t)}
                              title={taken ? bookedEntry?.reason || "Already booked" : undefined}
                              style={taken ? unavailableDateStyle : undefined}
                              className={`rounded-md border px-2 py-1.5 text-xs ${
                                taken
                                  ? "cursor-not-allowed border-gray-200 text-gray-400"
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
              disabled={!selectedService || !selectedDate || !selectedTime}
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
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Details</h2>

          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            <div>
              {selectedService?.name} (
              {vehicleTypes.find((v) => v.slug === vehicle)?.name ?? vehicle}) — $
              {selectedService?.price.toFixed(2)}
            </div>
            <div>
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

          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Select Payment Method
            </label>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm ${
                    paymentMethod === m.value
                      ? "border-brand-600 bg-brand-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      paymentMethod === m.value
                        ? "border-brand-600"
                        : "border-gray-300"
                    }`}
                  >
                    {paymentMethod === m.value && (
                      <span className="h-2 w-2 rounded-full bg-brand-600" />
                    )}
                  </span>
                  <span className="text-gray-800">{m.label}</span>
                </button>
              ))}
            </div>

            {paymentMethod === "card" && (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-md border border-gray-200 bg-gray-50 p-4">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Card Number
                  </label>
                  <input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="1234 5678 9012 3456"
                    inputMode="numeric"
                    maxLength={19}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Expiry Date
                  </label>
                  <input
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                    inputMode="numeric"
                    maxLength={5}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    CVV
                  </label>
                  <input
                    value={cardCvv}
                    onChange={(e) =>
                      setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="123"
                    inputMode="numeric"
                    maxLength={4}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            <p className="mt-2 text-xs text-gray-400">
              Card transactions may incur a processing fee of up to 1.1%.
              Payment is collected at the time of service, not now.
            </p>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-600"
            >
              Previous
            </button>
            <button
              disabled={!name || !phone || !email || submitting}
              onClick={handleConfirm}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {submitting ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-green-800">
            Booking Confirmed!
          </h2>
          <p className="mt-2 text-sm text-green-700">
            Booking reference: {confirmedId}
          </p>
          <p className="mt-1 text-sm text-green-700">
            {selectedService?.name} on {selectedDate} at{" "}
            {selectedTime && formatTimeLabel(selectedTime)}
          </p>
        </div>
      )}
    </div>
  );
}
