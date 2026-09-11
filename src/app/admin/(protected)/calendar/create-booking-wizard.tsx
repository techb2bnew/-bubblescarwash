"use client";

import { useMemo, useState } from "react";
import type { Customer, Extra, Service, ServiceCategoryRow, VehicleTypeRow } from "@/lib/types";
import type { PaymentMode } from "@/lib/payment-mode";
import { formatTimeLabel, unavailableDateStyle } from "@/lib/date-utils";
import { previewCustomerDiscount, type CustomerDiscountPreview } from "@/app/book/actions";
import { createBookingAdminCheckout, createBookingAdminPayLater } from "./actions";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEP_LABELS: Record<Step, string> = {
  1: "Customer",
  2: "Vehicle",
  3: "Category",
  4: "Service",
  5: "Add-Ons",
  6: "Time",
  7: "Payment",
};

export default function CreateBookingWizard({
  services,
  vehicleTypes,
  customers,
  extras,
  categories,
  bookingDate,
  timeSlots,
  bookedTimes,
  blockedTimes,
  getSlotBookingCount,
  slotUsageLabel,
  loadingSlots,
  paymentMode,
  onBooked,
}: {
  services: Service[];
  vehicleTypes: VehicleTypeRow[];
  customers: Pick<Customer, "id" | "name" | "phone" | "email">[];
  extras: Extra[];
  categories: ServiceCategoryRow[];
  bookingDate: string;
  timeSlots: string[];
  bookedTimes: string[];
  blockedTimes: string[];
  getSlotBookingCount: (time: string) => number;
  slotUsageLabel: (time: string) => string;
  loadingSlots: boolean;
  paymentMode: PaymentMode;
  onBooked: (time: string) => void;
}) {
  const [step, setStep] = useState<Step>(1);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [vehicleSlug, setVehicleSlug] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("");
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [time, setTime] = useState<string | null>(null);
  const [overrideAvailability, setOverrideAvailability] = useState(false);

  const [submitting, setSubmitting] = useState<"payLater" | "stripe" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerDiscount, setCustomerDiscount] = useState<CustomerDiscountPreview | null>(null);

  // Purely a preview so the admin can see the price Stripe will actually
  // charge before charging it — the real, authoritative match happens
  // automatically inside create_booking regardless of this preview.
  function checkCustomerDiscount(nextEmail: string, nextPhone: string) {
    if (!nextEmail.trim() && !nextPhone.trim()) return;
    previewCustomerDiscount(nextEmail, nextPhone)
      .then(setCustomerDiscount)
      .catch(() => {});
  }

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [customers, search]);

  const servicesForVehicle = useMemo(
    () =>
      services.filter(
        (s) => s.vehicle_type === vehicleSlug && (!categoryId || s.category_id === categoryId),
      ),
    [services, vehicleSlug, categoryId],
  );

  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  function toggleExtra(id: string) {
    setSelectedExtraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const selectedExtras = extras.filter((e) => selectedExtraIds.includes(e.id));
  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const basePrice = selectedService?.price ?? 0;
  // The override (walk-in) path is a raw insert that skips create_booking
  // entirely, so no discount ever applies there — only preview one when a
  // real create_booking call is actually going to happen.
  const discountAmount =
    customerDiscount && !overrideAvailability
      ? customerDiscount.discountType === "percent"
        ? Math.round(basePrice * customerDiscount.value) / 100
        : Math.min(customerDiscount.value, basePrice)
      : 0;
  const totalPrice = basePrice - discountAmount + extrasTotal;

  function selectCustomer(c: Pick<Customer, "id" | "name" | "phone" | "email">) {
    setSelectedCustomerId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email);
    setCustomerDiscount(null);
    checkCustomerDiscount(c.email, c.phone);
  }

  function resetWizard() {
    setStep(1);
    setCustomerMode("existing");
    setSearch("");
    setSelectedCustomerId(null);
    setName("");
    setPhone("");
    setEmail("");
    setVehicleSlug("");
    setCategoryId(categories[0]?.id ?? "");
    setServiceId("");
    setSelectedExtraIds([]);
    setTime(null);
    setOverrideAvailability(false);
    setError(null);
    setCustomerDiscount(null);
  }

  async function handlePayLater() {
    if (!serviceId || !time) return;
    setSubmitting("payLater");
    setError(null);
    try {
      await createBookingAdminPayLater({
        service_id: serviceId,
        vehicle_type: vehicleSlug,
        booking_date: bookingDate,
        booking_time: `${time}:00`,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        extra_ids: selectedExtraIds,
        overrideAvailability,
      });
      onBooked(time);
      resetWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleStripe() {
    if (!serviceId || !time) return;
    setSubmitting("stripe");
    setError(null);
    try {
      const { url } = await createBookingAdminCheckout({
        service_id: serviceId,
        vehicle_type: vehicleSlug,
        booking_date: bookingDate,
        booking_time: `${time}:00`,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        extra_ids: selectedExtraIds,
        overrideAvailability,
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(null);
    }
  }

  const canAdvance =
    (step === 1 && name.trim() && phone.trim() && email.trim()) ||
    (step === 2 && vehicleSlug) ||
    (step === 3 && categoryId) ||
    (step === 4 && serviceId) ||
    step === 5 ||
    (step === 6 && time);

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 text-xs font-medium text-gray-500">
        {([1, 2, 3, 4, 5, 6, 7] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">›</span>}
            <span className={s === step ? "font-semibold text-brand-700" : s < step ? "text-gray-700" : ""}>
              {STEP_LABELS[s]}
            </span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCustomerMode("existing")}
              className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                customerMode === "existing"
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              Existing customer
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode("new");
                setSelectedCustomerId(null);
                setName("");
                setPhone("");
                setEmail("");
              }}
              className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
                customerMode === "new"
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              + New customer
            </button>
          </div>

          {customerMode === "existing" ? (
            <div>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedCustomerId(null);
                }}
                placeholder="Search name, phone, email..."
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className={`block w-full rounded-md border px-2.5 py-1.5 text-left text-sm ${
                      selectedCustomerId === c.id
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      {c.phone} · {c.email}
                    </div>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="px-2 py-3 text-xs text-gray-400">No matching customers.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setCustomerDiscount(null);
                }}
                onBlur={() => checkCustomerDiscount(email, phone)}
                placeholder="Phone"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setCustomerDiscount(null);
                }}
                onBlur={() => checkCustomerDiscount(email, phone)}
                placeholder="Email"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-2 gap-2">
          {vehicleTypes.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setVehicleSlug(v.slug);
                setServiceId("");
              }}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                vehicleSlug === v.slug
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          {categories.length === 0 ? (
            <p className="text-xs text-gray-400">No categories yet.</p>
          ) : (
            categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategoryId(c.id);
                  setServiceId("");
                }}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm font-medium ${
                  categoryId === c.id
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          {servicesForVehicle.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                serviceId === s.id
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-gray-500">
                ${s.price.toFixed(2)} · {s.duration_minutes} min
              </span>
            </button>
          ))}
          {servicesForVehicle.length === 0 && (
            <p className="text-xs text-gray-400">No active services for this vehicle type.</p>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2">
          {extras.length === 0 ? (
            <p className="text-xs text-gray-400">No add-ons available.</p>
          ) : (
            extras.map((extra) => {
              const checked = selectedExtraIds.includes(extra.id);
              return (
                <label
                  key={extra.id}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                    checked
                      ? "border-brand-600 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span>
                    <span className="font-medium text-gray-900">{extra.name}</span>
                    {extra.description && (
                      <span className="ml-2 text-xs text-gray-500">{extra.description}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-gray-500">${extra.price.toFixed(2)}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExtra(extra.id)}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </span>
                </label>
              );
            })
          )}
        </div>
      )}

      {step === 6 && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={overrideAvailability}
              onChange={(e) => {
                setOverrideAvailability(e.target.checked);
                setTime(null);
              }}
              className="h-4 w-4 accent-brand-600"
            />
            Override availability (walk-in)
          </label>
          {overrideAvailability && (
            <p className="text-xs text-gray-500">
              Allows booking a full/blocked slot. Pay Later and Stripe both work;
              discounts don&apos;t apply to an overridden booking.
            </p>
          )}

          {loadingSlots ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {timeSlots.map((t) => {
                const count = getSlotBookingCount(t);
                const full = bookedTimes.includes(t);
                const blocked = blockedTimes.includes(t);
                const disabled = !overrideAvailability && (full || blocked);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    onClick={() => setTime(t)}
                    style={disabled && blocked ? unavailableDateStyle : undefined}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      disabled
                        ? full
                          ? "cursor-not-allowed border-blue-200 bg-blue-50 text-blue-600"
                          : "cursor-not-allowed border-red-200 text-red-600"
                        : time === t
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : count > 0 && !full
                            ? "border-blue-200 bg-blue-50/50 text-blue-700 hover:border-blue-300"
                            : (full || blocked) && overrideAvailability
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
      )}

      {step === 7 && (
        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="font-medium text-gray-900">{name}</div>
            <div className="text-xs text-gray-500">
              {phone} · {email}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {selectedService?.name} (${basePrice.toFixed(2)}) —{" "}
              {time ? formatTimeLabel(time) : ""}
              {overrideAvailability ? " (override)" : ""}
            </div>
            {selectedExtras.length > 0 && (
              <div className="mt-1">
                {selectedExtras.map((extra) => (
                  <div key={extra.id} className="flex justify-between text-xs text-gray-500">
                    <span>+ {extra.name}</span>
                    <span>${extra.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            {discountAmount > 0 && (
              <div className="mt-1 flex justify-between text-xs text-green-700">
                <span>Discount ({customerDiscount?.name})</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between font-medium text-gray-900">
              <span>Total</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
          </div>

          {customerDiscount && !overrideAvailability && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              This customer qualifies for <strong>{customerDiscount.name}</strong> — it&apos;s
              applied automatically above.
            </p>
          )}
          {customerDiscount && overrideAvailability && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This customer has a discount ({customerDiscount.name}), but override bookings don&apos;t
              apply discounts — full price will be charged.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePayLater}
              disabled={submitting !== null}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting === "payLater" ? "Creating..." : "Pay Later"}
            </button>
            {paymentMode === "stripe" && (
              <button
                type="button"
                onClick={handleStripe}
                disabled={submitting !== null}
                className="rounded-md border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                {submitting === "stripe" ? "Redirecting..." : "Charge via Stripe"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
        >
          Back
        </button>
        {step < 7 && (
          <button
            type="button"
            onClick={() => setStep((s) => (s < 7 ? ((s + 1) as Step) : s))}
            disabled={!canAdvance}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
