"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BlockedDate,
  BusinessSettings,
  Extra,
  Service,
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
import type { PaymentMode } from "@/lib/payment-mode";
import {
  countBookingsByEmail,
  createBookingSimple,
  createCheckoutSession,
  getBookedTimes,
  getDateHours,
  previewCustomerDiscount,
  previewDiscount,
  previewGiftCard,
  type BookedTime,
  type CustomerDiscountPreview,
} from "./actions";

const BOOKING_LIMIT = 5;

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
  extras,
  vehicleTypes,
  settings,
  blockedDates,
  paymentMode,
}: {
  services: Service[];
  extras: Extra[];
  vehicleTypes: VehicleTypeRow[];
  settings: BusinessSettings;
  blockedDates: BlockedDate[];
  paymentMode: PaymentMode;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [vehicle, setVehicle] = useState<VehicleType>(vehicleTypes[0]?.slug ?? "");
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
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].value);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitConfirmCount, setLimitConfirmCount] = useState<number | null>(null);

  const [giftCardInput, setGiftCardInput] = useState("");
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    code: string;
    value: number;
  } | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);

  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountType: "percent" | "fixed";
    value: number;
    name: string;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const [customerDiscount, setCustomerDiscount] = useState<CustomerDiscountPreview | null>(null);

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

  const vehicleServices = services.filter((s) => s.vehicle_type === vehicle);

  function toggleExtra(id: string) {
    setSelectedExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const selectedExtras = extras.filter((e) => selectedExtraIds.includes(e.id));
  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const basePrice = selectedService?.price ?? 0;
  // A customer-targeted discount (auto-matched by email/phone) takes
  // priority over a typed coupon code, same precedence create_booking uses.
  const activeDiscount = customerDiscount ?? appliedDiscount;
  const discountAmount = activeDiscount
    ? activeDiscount.discountType === "percent"
      ? Math.round(basePrice * activeDiscount.value) / 100
      : Math.min(activeDiscount.value, basePrice)
    : 0;
  const subtotal = basePrice - discountAmount + extrasTotal;
  const giftCardDiscount = appliedGiftCard
    ? Math.min(appliedGiftCard.value, subtotal)
    : 0;
  const totalPrice = subtotal - giftCardDiscount;

  async function handleApplyGiftCard() {
    const code = giftCardInput.trim();
    if (!code) return;
    setCheckingGiftCard(true);
    setGiftCardError(null);
    try {
      const result = await previewGiftCard(code);
      if (!result.valid) {
        setGiftCardError(
          result.reason === "already used"
            ? "This gift card has already been used."
            : result.reason === "expired"
              ? "This gift card has expired."
              : result.reason === "cancelled"
                ? "This gift card is no longer valid."
                : "We couldn't find a gift card with that code.",
        );
        return;
      }
      setAppliedGiftCard({ code, value: result.value ?? 0 });
      setGiftCardInput("");
    } catch {
      setGiftCardError("Something went wrong checking that code. Please try again.");
    } finally {
      setCheckingGiftCard(false);
    }
  }

  function handleRemoveGiftCard() {
    setAppliedGiftCard(null);
    setGiftCardError(null);
  }

  async function handleApplyDiscount() {
    const code = discountInput.trim();
    if (!code) return;
    setCheckingDiscount(true);
    setDiscountError(null);
    try {
      const result = await previewDiscount(code);
      if (!result.valid || !result.discountType || result.value == null) {
        setDiscountError(
          result.reason === "expired"
            ? "This discount code has expired."
            : result.reason === "limit reached"
              ? "This discount code has reached its redemption limit."
              : result.reason === "inactive"
                ? "This discount code is no longer active."
                : "We couldn't find a discount with that code.",
        );
        return;
      }
      setAppliedDiscount({
        code,
        discountType: result.discountType,
        value: result.value,
        name: result.name ?? code,
      });
      setDiscountInput("");
    } catch {
      setDiscountError("Something went wrong checking that code. Please try again.");
    } finally {
      setCheckingDiscount(false);
    }
  }

  function handleRemoveDiscount() {
    setAppliedDiscount(null);
    setDiscountError(null);
  }

  function handleCheckCustomerDiscount() {
    if (customerDiscount) return;
    previewCustomerDiscount(email, phone)
      .then(setCustomerDiscount)
      .catch(() => {});
  }

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
    const bookingInput = {
      service_id: selectedService.id,
      vehicle_type: vehicle,
      booking_date: selectedDate,
      booking_time: `${selectedTime}:00`,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      extra_ids: selectedExtraIds,
      gift_card_code: appliedGiftCard?.code,
      discount_code: appliedDiscount?.code,
    };
    try {
      if (paymentMode === "stripe") {
        const { url } = await createCheckoutSession(bookingInput);
        window.location.href = url;
        // Intentionally leave `submitting` true — the page is navigating away.
      } else {
        const { bookingId } = await createBookingSimple(bookingInput);
        router.push(`/book/confirmation?booking_id=${bookingId}`);
      }
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
          {vehicleServices.length === 0 ? (
            <p className="text-sm text-gray-400">
              No services configured for this vehicle type yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {vehicleServices.map((s) => {
                const activeInclusions = (s.inclusions ?? [])
                  .filter((i) => i.active)
                  .sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedService(s)}
                    className={`rounded-lg border p-4 text-left ${
                      selectedService?.id === s.id
                        ? "border-brand-600 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-gray-900">{s.name}</span>
                      <span className="shrink-0 font-bold text-brand-600">
                        ${s.price.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{s.duration_minutes} min</p>
                    {activeInclusions.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {activeInclusions.map((inc) => (
                          <li
                            key={inc.id}
                            className="flex items-center gap-1.5 text-xs text-gray-600"
                          >
                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                              <svg
                                width="8"
                                height="8"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            </span>
                            {inc.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
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
              {basePrice.toFixed(2)}
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
            {activeDiscount && (
              <div className="mt-1 flex justify-between text-xs text-green-700">
                <span>Discount ({customerDiscount ? customerDiscount.name : appliedDiscount?.code})</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            {appliedGiftCard && (
              <div className="mt-1 flex justify-between text-xs text-green-700">
                <span>Gift card ({appliedGiftCard.code})</span>
                <span>-${giftCardDiscount.toFixed(2)}</span>
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

          {customerDiscount && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              🎉 You qualify for <strong>{customerDiscount.name}</strong> — applied
              automatically, no code needed.
            </div>
          )}

          <div className="mb-4">
            {appliedDiscount ? (
              <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                <span className="text-green-800">
                  Discount code <strong>{appliedDiscount.code}</strong> applied
                </span>
                <button
                  type="button"
                  onClick={handleRemoveDiscount}
                  className="font-medium text-green-700 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Have a discount code?
                </label>
                <div className="flex gap-2">
                  <input
                    value={discountInput}
                    onChange={(e) => {
                      setDiscountInput(e.target.value.toUpperCase());
                      setDiscountError(null);
                    }}
                    placeholder="e.g. SAVE20"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!discountInput.trim() || checkingDiscount}
                    onClick={handleApplyDiscount}
                    className="shrink-0 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 disabled:opacity-40"
                  >
                    {checkingDiscount ? "Checking..." : "Apply"}
                  </button>
                </div>
                {discountError && (
                  <p className="mt-1 text-xs text-red-600">{discountError}</p>
                )}
              </div>
            )}
          </div>

          <div className="mb-4">
            {appliedGiftCard ? (
              <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                <span className="text-green-800">
                  Gift card <strong>{appliedGiftCard.code}</strong> applied (-$
                  {appliedGiftCard.value.toFixed(2)})
                </span>
                <button
                  type="button"
                  onClick={handleRemoveGiftCard}
                  className="font-medium text-green-700 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Have a gift card code?
                </label>
                <div className="flex gap-2">
                  <input
                    value={giftCardInput}
                    onChange={(e) => {
                      setGiftCardInput(e.target.value.toUpperCase());
                      setGiftCardError(null);
                    }}
                    placeholder="e.g. ABC12345"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!giftCardInput.trim() || checkingGiftCard}
                    onClick={handleApplyGiftCard}
                    className="shrink-0 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 disabled:opacity-40"
                  >
                    {checkingGiftCard ? "Checking..." : "Apply"}
                  </button>
                </div>
                {giftCardError && (
                  <p className="mt-1 text-xs text-red-600">{giftCardError}</p>
                )}
              </div>
            )}
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
                onChange={(e) => {
                  setPhone(e.target.value);
                  setCustomerDiscount(null);
                }}
                onBlur={handleCheckCustomerDiscount}
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setCustomerDiscount(null);
                }}
                onBlur={handleCheckCustomerDiscount}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {totalPrice === 0 ? (
            <div className="mt-5 rounded-md border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-900">Fully covered</p>
              <p className="mt-1 text-sm text-green-700">
                No payment is needed — your discount and/or gift card cover the full
                cost of this booking.
              </p>
            </div>
          ) : paymentMode === "stripe" ? (
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
              disabled={!name || !phone || !email || submitting}
              onClick={handleConfirm}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {submitting
                ? paymentMode === "stripe" && totalPrice > 0
                  ? "Redirecting to Stripe..."
                  : "Confirming..."
                : totalPrice === 0
                  ? "Confirm Booking — Free"
                  : paymentMode === "stripe"
                    ? `Continue to Payment — $${totalPrice.toFixed(2)}`
                    : `Confirm Booking — $${totalPrice.toFixed(2)} due in person`}
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
