"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import type { PaymentMode } from "@/lib/payment-mode";
import {
  countBookingsByEmail,
  createBookingSimple,
  createCheckoutSession,
  getBookedTimes,
  getDateHours,
  previewGiftCard,
  type BookedTime,
} from "./actions";

const BOOKING_LIMIT = 5;

// A real photo per vehicle body type, matched by keywords in the
// admin-configured vehicle type name — so "Sedan" shows an actual sedan,
// "SUV/4WD" an actual SUV, etc. Each car is orange to match the Bubbles
// brand palette. Falls back to cycling through the set for any name that
// doesn't match a keyword.
const VEHICLE_TYPE_PHOTOS: { keywords: string[]; src: string; alt: string; position: string }[] = [
  {
    keywords: ["sedan"],
    src: "https://images.pexels.com/photos/12590806/pexels-photo-12590806.jpeg",
    alt: "Orange sedan, close-up side profile",
    position: "center 40%",
  },
  {
    keywords: ["suv", "4wd"],
    src: "https://images.pexels.com/photos/19923026/pexels-photo-19923026.jpeg",
    alt: "Orange SUV, side profile",
    position: "center 55%",
  },
  {
    keywords: ["pickup", "x-large", "xlarge", "ute"],
    src: "https://images.pexels.com/photos/14156803/pexels-photo-14156803.jpeg",
    alt: "Orange pickup truck, side profile",
    position: "center 55%",
  },
  {
    keywords: ["van", "minibus", "xxl", "7 seat", "7seat"],
    src: "https://images.pexels.com/photos/28087030/pexels-photo-28087030.jpeg",
    alt: "Orange van, side profile",
    position: "center 70%",
  },
];

function getVehicleTypePhoto(name: string, fallbackIndex: number) {
  const lower = name.toLowerCase();
  const match = VEHICLE_TYPE_PHOTOS.find((p) => p.keywords.some((k) => lower.includes(k)));
  return match ?? VEHICLE_TYPE_PHOTOS[fallbackIndex % VEHICLE_TYPE_PHOTOS.length];
}

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
  extras,
  vehicleTypes,
  categories,
  settings,
  blockedDates,
  paymentMode,
}: {
  services: Service[];
  inclusions: AddOn[];
  extras: Extra[];
  vehicleTypes: VehicleTypeRow[];
  categories: CategoryRow[];
  settings: BusinessSettings;
  blockedDates: BlockedDate[];
  paymentMode: PaymentMode;
}) {
  const router = useRouter();
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
  const subtotal = (selectedService?.effective_price ?? 0) + extrasTotal;
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
      booking_date: selectedDate,
      booking_time: `${selectedTime}:00`,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      extra_ids: selectedExtraIds,
      gift_card_code: appliedGiftCard?.code,
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

  const stepLabels = ["Vehicle & Service", "Add-ons", "Your Details"];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10 flex items-center justify-center">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold shadow-sm transition-colors ${
                  step > n
                    ? "bg-brand-600 text-white"
                    : step === n
                      ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-brand-600/30 ring-4 ring-brand-100"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {step > n ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  n
                )}
              </div>
              <span
                className={`text-[11px] font-semibold sm:text-xs ${
                  step >= n ? "text-brand-700" : "text-gray-400"
                }`}
              >
                {stepLabels[n - 1]}
              </span>
            </div>
            {n < 3 && (
              <div
                className={`mx-3 mb-6 h-1 w-14 rounded-full transition-colors sm:w-24 ${
                  step > n ? "bg-brand-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            Get Started
          </p>
          <h2 className="mb-6 mt-1.5 text-2xl font-extrabold text-gray-900">
            Select Vehicle &amp; <span className="wave-word">Service</span>
          </h2>

          {vehicleTypes.length > 0 && (
            <div
              className="relative mb-7 overflow-hidden rounded-2xl"
              style={{
                backgroundColor: "#0b1220",
                backgroundImage:
                  "repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 60px)",
              }}
            >
              <div className="relative px-5 pt-8 text-center sm:px-8 sm:pt-10">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">
                  Step 01
                </span>
                <h3 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
                  Choose Your Car Type
                </h3>
                <div className="mt-6 inline-flex flex-wrap justify-center gap-2 rounded-full bg-white/5 p-1.5 ring-1 ring-white/10">
                  {vehicleTypes.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setVehicle(v.slug);
                        setSelectedService(null);
                      }}
                      className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                        vehicle === v.slug
                          ? "bg-brand-600 text-white shadow-sm"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mt-6 h-56 sm:h-72">
                {vehicleTypes.map((v, i) => {
                  const photo = getVehicleTypePhoto(v.name, i);
                  return (
                    <div
                      key={v.id}
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        vehicle === v.slug ? "opacity-100" : "pointer-events-none opacity-0"
                      }`}
                    >
                      <Image
                        src={photo.src}
                        alt={`${photo.alt} — ${v.name}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 700px"
                        className="object-cover"
                        style={{ objectPosition: photo.position }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="h-6" />
            </div>
          )}

          <p className="mb-2.5 text-sm font-semibold text-gray-700">Select Service</p>
          <div className="mb-7 grid grid-cols-2 gap-3">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCategory(c.slug);
                  setSelectedService(null);
                }}
                className={`rounded-xl border-2 py-3.5 text-sm font-semibold transition ${
                  category === c.slug
                    ? "border-brand-600 bg-brand-50 text-brand-700 shadow-sm"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
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
            <div
              className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
                tierServices.length >= 3 ? "lg:grid-cols-3" : ""
              }`}
            >
              {tierServices.map((s, si) => {
                const active = selectedService?.id === s.id;
                const popular = tierServices.length > 1 && si === Math.floor((tierServices.length - 1) / 2);
                const includedInclusions = categoryInclusions.filter((inc) => hasInclusion(s, inc.id));
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedService(s)}
                    className={`relative flex flex-col rounded-2xl border-2 p-5 text-left transition ${
                      active
                        ? "border-brand-600 bg-brand-50/50 shadow-lg shadow-brand-600/10"
                        : "border-gray-200 hover:border-brand-200 hover:shadow-sm"
                    }`}
                  >
                    {popular && (
                      <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                        Most Popular
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-base font-extrabold text-gray-900">{s.name}</span>
                      <span
                        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition ${
                          active ? "border-brand-600 bg-brand-600" : "border-gray-300"
                        }`}
                      >
                        {active && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    </div>
                    {s.discount_active && s.discount_percent > 0 ? (
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="text-sm text-gray-400 line-through">${s.price.toFixed(2)}</span>
                        <span className="text-2xl font-extrabold text-brand-600">${s.effective_price.toFixed(2)}</span>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-2xl font-extrabold text-brand-600">${s.price.toFixed(2)}</p>
                    )}
                    <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                      {includedInclusions.length === 0 ? (
                        <li className="text-xs text-gray-400">No inclusions listed</li>
                      ) : (
                        includedInclusions.map((inc) => (
                          <li key={inc.id} className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-500/15 text-brand-600">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            </span>
                            {inc.name}
                          </li>
                        ))
                      )}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-9 border-t border-gray-100 pt-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              Pick A Slot
            </p>
            <h2 className="mb-6 mt-1.5 text-2xl font-extrabold text-gray-900">
              Choose Your Date &amp; <span className="wave-word">Time</span>
            </h2>

            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="rounded-2xl border border-gray-200 p-5 shadow-sm md:flex-1">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-brand-600"
                  >
                    «
                  </button>
                  <span className="text-sm font-bold text-gray-900">
                    {MONTH_NAMES[cursor.month]} {cursor.year}
                  </span>
                  <button
                    onClick={() => changeMonth(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-brand-600"
                  >
                    »
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400">
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
                        className={`aspect-square rounded-lg text-sm font-medium transition ${
                          !inMonth ? "text-gray-300" : ""
                        } ${
                          disabled && inMonth
                            ? "cursor-not-allowed text-gray-400"
                            : "hover:bg-brand-50 hover:text-brand-700"
                        } ${selectedDate === key ? "bg-brand-600 text-white shadow-sm hover:bg-brand-600 hover:text-white" : ""}`}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 p-5 shadow-sm md:w-72 md:flex-none">
                {selectedDate ? (
                  <>
                    <h3 className="mb-3 text-sm font-bold text-gray-800">
                      Available times on {selectedDate}
                    </h3>
                    {loadingTimes ? (
                      <p className="text-sm text-gray-400">Loading...</p>
                    ) : timesError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {timesError}
                        <button
                          type="button"
                          onClick={() => handleSelectDate(selectedDate)}
                          className="mt-2 block font-semibold underline"
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
                              className={`rounded-lg border-2 px-2 py-2 text-xs font-semibold transition ${
                                taken
                                  ? blocked
                                    ? "cursor-not-allowed border-red-200 text-red-600"
                                    : "cursor-not-allowed border-blue-200 bg-blue-50 text-blue-600"
                                  : selectedTime === t
                                    ? "border-brand-600 bg-brand-50 text-brand-700 shadow-sm"
                                    : "border-gray-200 text-gray-600 hover:border-brand-200 hover:bg-brand-50/50"
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

          <div className="mt-8 flex justify-end">
            <button
              disabled={
                !selectedService || !selectedDate || !selectedTime || Boolean(timesError)
              }
              onClick={() => setStep(2)}
              className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            Make It Shine
          </p>
          <h2 className="mb-1 mt-1.5 text-2xl font-extrabold text-gray-900">
            Optional <span className="wave-word">Add-ons</span>
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            Add any extra services to {selectedService?.name ?? "your booking"}.
          </p>

          {extras.length === 0 ? (
            <p className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-400 shadow-sm">
              No add-ons available right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {extras.map((extra) => {
                const checked = selectedExtraIds.includes(extra.id);
                return (
                  <label
                    key={extra.id}
                    className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border-2 p-4 transition ${
                      checked
                        ? "border-brand-600 bg-brand-50/50 shadow-sm shadow-brand-600/10"
                        : "border-gray-200 hover:border-brand-200 hover:shadow-sm"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900">{extra.name}</p>
                      {extra.description && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {extra.description}
                        </p>
                      )}
                      <p className="mt-2 text-sm font-extrabold text-brand-600">
                        ${extra.price.toFixed(2)}
                      </p>
                    </div>
                    <span
                      className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border-2 transition ${
                        checked ? "border-brand-600 bg-brand-600" : "border-gray-300"
                      }`}
                    >
                      {checked && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExtra(extra.id)}
                      className="sr-only"
                    />
                  </label>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between rounded-2xl bg-gray-50 px-5 py-4 text-sm">
            <span className="font-medium text-gray-600">Estimated total</span>
            <span className="text-lg font-extrabold text-gray-900">
              ${totalPrice.toFixed(2)}
            </span>
          </div>

          <div className="mt-7 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-full border-2 border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setStep(3)}
              className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            Almost There
          </p>
          <h2 className="mb-6 mt-1.5 text-2xl font-extrabold text-gray-900">
            Your <span className="wave-word">Details</span>
          </h2>

          <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 shadow-sm">
            <div>
              {selectedService?.name} (
              {vehicleTypes.find((v) => v.slug === vehicle)?.name ?? vehicle}) —{" "}
              {selectedService?.discount_active && selectedService.discount_percent > 0 ? (
                <>
                  <span className="text-gray-400 line-through">
                    ${selectedService.price.toFixed(2)}
                  </span>{" "}
                  <span className="font-medium text-green-700">
                    ${selectedService.effective_price.toFixed(2)}
                  </span>
                </>
              ) : (
                `$${selectedService?.price.toFixed(2)}`
              )}
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

          <div className="mb-5">
            {appliedGiftCard ? (
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm">
                <span className="text-green-800">
                  Gift card <strong>{appliedGiftCard.code}</strong> applied (-$
                  {appliedGiftCard.value.toFixed(2)})
                </span>
                <button
                  type="button"
                  onClick={handleRemoveGiftCard}
                  className="font-semibold text-green-700 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
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
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    type="button"
                    disabled={!giftCardInput.trim() || checkingGiftCard}
                    onClick={handleApplyGiftCard}
                    className="shrink-0 rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
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

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Full name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Phone
              </label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Email
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          {totalPrice === 0 ? (
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
              <p className="text-sm font-bold text-green-900">
                Fully covered by your gift card
              </p>
              <p className="mt-1 text-sm text-green-700">
                No payment is needed — your gift card covers the full cost of
                this booking.
              </p>
            </div>
          ) : paymentMode === "stripe" ? (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <p className="text-sm font-bold text-blue-900">
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
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Select Payment Method
              </label>
              <div className="space-y-2.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-sm transition ${
                      paymentMethod === m.value
                        ? "border-brand-600 bg-brand-50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
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
                    <span className="font-medium text-gray-800">{m.label}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === "card" && (
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                      Card Number
                    </label>
                    <input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="1234 5678 9012 3456"
                      inputMode="numeric"
                      maxLength={19}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                      Expiry Date
                    </label>
                    <input
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      inputMode="numeric"
                      maxLength={5}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
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

          <div className="mt-7 flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="rounded-full border-2 border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={!name || !phone || !email || submitting}
              onClick={handleConfirm}
              className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900">
              Booking limit reached
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This email has already been used for {limitConfirmCount} bookings.
              Do you still want to continue with this booking?
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setLimitConfirmCount(null)}
                className="rounded-full border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setLimitConfirmCount(null);
                  submitBooking();
                }}
                className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
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
