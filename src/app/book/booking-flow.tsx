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

// A simple car-silhouette icon per vehicle body type, matched by keywords in
// the admin-configured vehicle type name — clean and consistent instead of
// relying on stock photos that vary wildly in quality/crop.
function getVehicleTypeIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("van") || lower.includes("minibus") || lower.includes("xxl") || lower.includes("7 seat") || lower.includes("7seat")) {
    return (
      <svg viewBox="0 0 48 24" fill="none" className="h-8 w-14">
        <path d="M3 17V9a2 2 0 0 1 2-2h26l9 6v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 17h37" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M22 7v10M31 13v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="33" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (lower.includes("pickup") || lower.includes("x-large") || lower.includes("xlarge") || lower.includes("ute")) {
    return (
      <svg viewBox="0 0 48 24" fill="none" className="h-8 w-14">
        <path d="M3 17v-5l6-5h9v10M25 17V9h8l9 5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 17h39" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="13" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="34" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (lower.includes("suv") || lower.includes("4wd")) {
    return (
      <svg viewBox="0 0 48 24" fill="none" className="h-8 w-14">
        <path d="M4 17v-4l4-6h20l8 5h8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17h40" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11 7v6M28 7v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="13" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="35" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 24" fill="none" className="h-8 w-14">
      <path d="M5 17v-3l5-7h18l7 6h8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 17h38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7l-2 5M24 7v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="34" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

// A distinct icon per add-on, matched by phrase in its (admin-configured, so
// arbitrary) name — checked most-specific-first so near-identical extras
// ("Mats Steam Clean" vs "Carpet Steam Clean") still get visually different
// icons instead of all collapsing onto one generic symbol.
function getExtraIcon(name: string) {
  const lower = name.toLowerCase();

  if (lower.includes("mag wheel")) {
    // alloy rim: spoked wheel
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 12 12 5M12 12l6 3.5M12 12l-6 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (lower.includes("wheels detailed")) {
    // tyre: circle with tread dashes
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (lower.includes("leather seats") || lower.includes("leather treatment")) {
    // stitched seat back
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="6" y="4" width="12" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 4v16M15 4v16" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 2" />
      </svg>
    );
  }
  if (lower.includes("cloth seat") || lower.includes("seats steam")) {
    // seat + steam wisps
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M7 20v-7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 4c-.8 1-.8 1.6 0 2.6M13 4c-.8 1-.8 1.6 0 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (lower.includes("carpet extraction")) {
    // vacuum nozzle
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="4" y="10" width="6" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 13h5a4 4 0 0 0 4-4V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (lower.includes("carpet steam")) {
    // floor with steam
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M3 17h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8 5c-1 1.4-1 2.2 0 3.6M12 5c-1 1.4-1 2.2 0 3.6M16 5c-1 1.4-1 2.2 0 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M3 17V9h18v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (lower.includes("mats steam") || lower.includes("mat")) {
    // floor mat grid
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 10h16M4 14h16" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (lower.includes("protective wax") || lower.includes("protect")) {
    // shield
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 3 3 7.5v5c0 5 4 8.5 9 10 5-1.5 9-5 9-10v-5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (lower.includes("hand wax")) {
    // hand with sparkle
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 11V5a1.5 1.5 0 0 1 3 0v6M14 12V7a1.5 1.5 0 0 1 3 0v7c0 3-2 5-5.5 5-2.5 0-3.7-1-4.5-2.5L5 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (lower.includes("head light")) {
    // beam of light
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 10l10-3M9 12h11M9 14l10 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (lower.includes("clay bar")) {
    // rounded bar
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="4" y="9" width="16" height="6" rx="3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (lower.includes("cut") && lower.includes("polish")) {
    // buffer pad
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" />
      </svg>
    );
  }
  if (lower.includes("interior detail")) {
    // steering wheel
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 6v4M8 15l3-1.5M16 15l-3-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (lower.includes("full detail")) {
    // sparkle burst
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

type Step = 1 | 2 | 3;

const PAYMENT_METHODS = [
  {
    value: "card",
    label: "Credit Card / Apple Pay / Google Pay",
    brands: "Visa · Mastercard · Apple Pay · G Pay",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 9.5h19" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    value: "afterpay",
    label: "Afterpay",
    brands: "Buy now, pay later",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M7 15 3 12l4-3M17 9l4 3-4 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 16 15 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "zip",
    label: "Zip Pay",
    brands: "Buy now, pay later",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7.5 9h9l-9 6h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
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

  const stepLabels = ["Vehicle & Service", "Add-ons", "Your Details"];

  return (
    <div className="mx-auto max-w-5xl">
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
          <h2 className="mt-1.5 text-2xl font-extrabold text-gray-900">
            Select Vehicle &amp; <span className="wave-word">Service</span>
          </h2>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            Choose the vehicle that best matches what you drive.
          </p>

          {vehicleTypes.length > 0 && (
            <div className="mb-7">
              <p className="mb-4 text-sm font-semibold text-gray-700">What are you driving?</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {vehicleTypes.map((v) => {
                  const active = vehicle === v.slug;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setVehicle(v.slug);
                        setSelectedService(null);
                      }}
                      className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        active
                          ? "border-brand-600 bg-brand-50 shadow-brand-600/10"
                          : "border-gray-200 hover:border-brand-200"
                      }`}
                    >
                      <span className={active ? "text-brand-600" : "text-gray-400"}>
                        {getVehicleTypeIcon(v.name)}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{v.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mb-2.5 text-sm font-semibold text-gray-700">Select Service</p>
          {vehicleServices.length === 0 ? (
            <p className="text-sm text-gray-400">
              No services configured for this vehicle type yet.
            </p>
          ) : (
            <div
              className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
                vehicleServices.length >= 4 ? "lg:grid-cols-4" : vehicleServices.length >= 3 ? "lg:grid-cols-3" : ""
              }`}
            >
              {vehicleServices.map((s, si) => {
                const active = selectedService?.id === s.id;
                const popular = vehicleServices.length > 1 && si === Math.floor((vehicleServices.length - 1) / 2);
                const activeInclusions = (s.inclusions ?? [])
                  .filter((i) => i.active)
                  .sort((a, b) => a.sort_order - b.sort_order);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedService(s)}
                    className={`relative flex flex-col rounded-2xl border-2 p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${
                      active
                        ? "border-brand-600 bg-brand-50/50 shadow-lg shadow-brand-600/10"
                        : "border-gray-200 hover:border-brand-200 hover:shadow-md"
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
                    <p className="mt-1.5 text-2xl font-extrabold text-brand-600">${s.price.toFixed(2)}</p>
                    <p className="mt-1 text-xs text-gray-400">{s.duration_minutes} min</p>
                    <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                      {activeInclusions.length === 0 ? (
                        <li className="text-xs text-gray-400">No inclusions listed</li>
                      ) : (
                        activeInclusions.map((inc) => (
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

              <div className="rounded-2xl border border-gray-200 p-5 shadow-sm md:w-80 md:flex-none">
                {selectedDate ? (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-800">
                        {selectedDate}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-brand-500" /> Available
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-blue-400" /> Booked
                        </span>
                      </div>
                    </div>
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
                      // A Google-Calendar-style day agenda: one row per slot, in
                      // chronological order, booked slots shown as a solid event
                      // block instead of just being omitted — so it's visually
                      // obvious which part of the day is already taken.
                      <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100">
                        {timeSlots.map((t) => {
                          const bookedEntry = bookedTimes.find((bt) => bt.time === t);
                          const taken = Boolean(bookedEntry);
                          const blocked = bookedEntry?.isBlocked ?? false;
                          const active = selectedTime === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              disabled={taken}
                              onClick={() => setSelectedTime(t)}
                              title={
                                taken
                                  ? bookedEntry?.reason ||
                                    (blocked ? "Not available" : "Already booked")
                                  : undefined
                              }
                              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition ${
                                taken ? "cursor-not-allowed" : "hover:bg-brand-50/60"
                              } ${active ? "bg-brand-50" : ""}`}
                            >
                              <span className="w-14 flex-none font-semibold text-gray-500">
                                {formatTimeLabel(t)}
                              </span>
                              {taken ? (
                                <span
                                  className={`flex-1 truncate rounded-md px-2.5 py-1.5 font-semibold ${
                                    blocked
                                      ? "bg-red-100 text-red-700"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {bookedEntry?.reason || (blocked ? "Not available" : "Booked")}
                                </span>
                              ) : (
                                <span
                                  className={`flex-1 rounded-md border-2 px-2.5 py-1.5 font-semibold ${
                                    active
                                      ? "border-brand-600 bg-white text-brand-700"
                                      : "border-dashed border-brand-200 text-brand-500"
                                  }`}
                                >
                                  Available
                                </span>
                              )}
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

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm md:w-64 md:flex-none">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
                  Your Booking
                </p>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="text-gray-400">Vehicle: </span>
                    {vehicleTypes.find((v) => v.slug === vehicle)?.name ?? "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Service: </span>
                    {selectedService?.name ?? "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Date: </span>
                    {selectedDate ?? "—"}
                  </p>
                  <p>
                    <span className="text-gray-400">Time: </span>
                    {selectedTime ? formatTimeLabel(selectedTime) : "—"}
                  </p>
                </div>
                {selectedService && (
                  <p className="mt-3 border-t border-gray-200 pt-3 text-base font-extrabold text-brand-600">
                    ${selectedService.price.toFixed(2)}
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
                    className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border-2 p-4 shadow-sm transition hover:-translate-y-0.5 ${
                      checked
                        ? "border-brand-600 bg-brand-50/50 shadow-brand-600/10"
                        : "border-gray-200 hover:border-brand-200 hover:shadow-md"
                    }`}
                  >
                    <div className="flex min-w-0 gap-3">
                      <span
                        className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${
                          checked ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600"
                        }`}
                      >
                        {getExtraIcon(extra.name)}
                      </span>
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
                Almost There
              </p>
              <h2 className="mt-1.5 text-2xl font-extrabold text-gray-900">
                Your <span className="wave-word">Details</span>
              </h2>
            </div>
            <div className="hidden shrink-0 items-start gap-1.5 text-right sm:flex">
              <span className="mt-0.5 text-brand-600">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <rect x="5" y="10" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <span>
                <span className="block text-xs font-bold text-gray-900">Secure Booking</span>
                <span className="block text-[11px] text-gray-400">
                  Your information is safe with us.
                </span>
              </span>
            </div>
          </div>

          <div className="mb-5 mt-6 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 shadow-sm sm:p-5">
            <p className="mb-3 text-sm font-bold text-gray-900">Booking Summary</p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
                  {getVehicleTypeIcon(vehicleTypes.find((v) => v.slug === vehicle)?.name ?? vehicle)}
                </span>
                <div className="min-w-0 text-sm text-gray-700">
                  <p className="font-bold text-gray-900">
                    {selectedService?.name}{" "}
                    <span className="font-normal text-gray-500">
                      ({vehicleTypes.find((v) => v.slug === vehicle)?.name ?? vehicle})
                    </span>
                  </p>
                  <p className="mt-0.5">${basePrice.toFixed(2)}</p>
                  {selectedExtras.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-xs font-semibold text-gray-500">Add-ons</p>
                      {selectedExtras.map((extra) => (
                        <div key={extra.id} className="flex justify-between gap-4 text-xs text-gray-600">
                          <span>+ {extra.name}</span>
                          <span>${extra.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeDiscount && (
                    <div className="mt-1 flex justify-between gap-4 text-xs text-green-700">
                      <span>Discount ({customerDiscount ? customerDiscount.name : appliedDiscount?.code})</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {appliedGiftCard && (
                    <div className="mt-1 flex justify-between gap-4 text-xs text-green-700">
                      <span>Gift card ({appliedGiftCard.code})</span>
                      <span>-${giftCardDiscount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-none gap-3 sm:flex-col sm:items-end">
                <div className="flex items-start gap-2">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-xs text-gray-600 sm:text-right">
                    <span className="block font-semibold text-gray-500">Date &amp; Time</span>
                    <span className="block font-bold text-gray-900">
                      {selectedDate}
                      {selectedTime && <> at {formatTimeLabel(selectedTime)}</>}
                    </span>
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                      <path d="M12 3v18M8 7.5c0-1.4 1.6-2.5 4-2.5s4 1 4 2.5-1.8 2.2-4 2.5c-2.2.3-4 1-4 2.5s1.6 2.5 4 2.5 4-1.1 4-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-xs text-gray-600 sm:text-right">
                    <span className="block font-semibold text-gray-500">Total</span>
                    <span className="block font-bold text-brand-600">${totalPrice.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {customerDiscount && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              🎉 You qualify for <strong>{customerDiscount.name}</strong> — applied automatically, no code needed.
            </div>
          )}

          <div className="mb-5">
            {appliedDiscount ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm">
                <span className="text-green-800">
                  Discount code <strong>{appliedDiscount.code}</strong> applied
                </span>
                <button
                  type="button"
                  onClick={handleRemoveDiscount}
                  className="shrink-0 font-semibold text-green-700 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path d="M11.5 4h6a2 2 0 0 1 2 2v6L9 22.5 1.5 15 11.5 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <circle cx="15" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
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
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <button
                      type="button"
                      disabled={!discountInput.trim() || checkingDiscount}
                      onClick={handleApplyDiscount}
                      className="shrink-0 rounded-xl border-2 border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-40"
                    >
                      {checkingDiscount ? "Checking..." : "Apply"}
                    </button>
                  </div>
                  {discountError && (
                    <p className="mt-1 text-xs text-red-600">{discountError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mb-5">
            {appliedGiftCard ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm">
                <span className="text-green-800">
                  Gift card <strong>{appliedGiftCard.code}</strong> applied (-$
                  {appliedGiftCard.value.toFixed(2)})
                </span>
                <button
                  type="button"
                  onClick={handleRemoveGiftCard}
                  className="shrink-0 font-semibold text-green-700 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M3 12h18M12 8v12" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 8c-1.4-2.6-3-3.5-4-3-1.2.6-.6 2.4 4 3ZM12 8c1.4-2.6 3-3.5 4-3 1.2.6.6 2.4-4 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
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
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <button
                      type="button"
                      disabled={!giftCardInput.trim() || checkingGiftCard}
                      onClick={handleApplyGiftCard}
                      className="shrink-0 rounded-xl border-2 border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-40"
                    >
                      {checkingGiftCard ? "Checking..." : "Apply"}
                    </button>
                  </div>
                  {giftCardError && (
                    <p className="mt-1 text-xs text-red-600">{giftCardError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <h3 className="mb-3 text-sm font-bold text-gray-900">
            Your <span className="wave-word">Information</span>
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Full name
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  required
                  placeholder="John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Phone
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path d="M6 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2C10.5 19 5 13.5 4 6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  required
                  placeholder="0412 345 678"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setCustomerDiscount(null);
                  }}
                  onBlur={handleCheckCustomerDiscount}
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 6.5 12 13l8-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  required
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setCustomerDiscount(null);
                  }}
                  onBlur={handleCheckCustomerDiscount}
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
          </div>

          {totalPrice === 0 ? (
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
              <p className="text-sm font-bold text-green-900">Fully covered</p>
              <p className="mt-1 text-sm text-green-700">
                No payment is needed — your discount and/or gift card cover the full
                cost of this booking.
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
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                Select <span className="wave-word">Payment</span> Method
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 text-center transition ${
                      paymentMethod === m.value
                        ? "border-brand-600 bg-brand-50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`absolute right-3 top-3 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        paymentMethod === m.value ? "border-brand-600" : "border-gray-300"
                      }`}
                    >
                      {paymentMethod === m.value && (
                        <span className="h-2 w-2 rounded-full bg-brand-600" />
                      )}
                    </span>
                    <span className={paymentMethod === m.value ? "text-brand-600" : "text-gray-400"}>
                      {m.icon}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">{m.label}</span>
                    {m.brands && (
                      <span className="text-[10px] text-gray-400">{m.brands}</span>
                    )}
                  </button>
                ))}
              </div>

              {paymentMethod === "card" && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                        <rect x="5" y="10" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                      Card Details
                    </p>
                    <p className="hidden text-[11px] text-gray-400 sm:block">
                      All payments are secure and encrypted
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
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
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-400">
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-3.5 w-3.5 flex-none">
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M12 11v5.5M12 8v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Card transactions may incur a processing fee of up to 1.1%. Payment is
                collected at the time of service, not now.
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

      <div className="mt-10 grid grid-cols-2 gap-4 border-t border-gray-100 pt-8 sm:grid-cols-4">
        {[
          {
            label: "Trusted by 5,000+ Happy Customers",
            icon: (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ),
          },
          {
            label: "High Quality Care & Products",
            icon: (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M12 3 3 7.5v5c0 5 4 8.5 9 10 5-1.5 9-5 9-10v-5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            ),
          },
          {
            label: "Safe for Your Car & the Environment",
            icon: (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M5 19c0-8 4-14 14-14 0 10-6 14-14 14Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M6 18c3-3 5-6 12-11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ),
          },
          {
            label: "Save Time with Online Booking",
            icon: (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ),
          },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              {item.icon}
            </span>
            <p className="text-xs font-semibold text-gray-600">{item.label}</p>
          </div>
        ))}
      </div>

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
