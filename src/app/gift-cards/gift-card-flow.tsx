"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { GiftCardProduct } from "@/lib/types";
import type { PaymentMode } from "@/lib/payment-mode";
import {
  DEFAULT_GIFT_CARD_DESIGN,
  GIFT_CARD_DESIGNS,
  MIN_GIFT_CARD_AMOUNT,
  type GiftCardDesign,
} from "@/lib/gift-card-designs";
import { createGiftCardCheckoutSession, createGiftCardSimple } from "./actions";

type Step = 1 | 2;

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

export default function GiftCardFlow({
  products,
  paymentMode,
}: {
  products: GiftCardProduct[];
  paymentMode: PaymentMode;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedDesign, setSelectedDesign] = useState<GiftCardDesign>(
    DEFAULT_GIFT_CARD_DESIGN,
  );
  const [selectedProduct, setSelectedProduct] = useState<GiftCardProduct | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const [purchaserName, setPurchaserName] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [purchaserPhone, setPurchaserPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0].value);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A custom amount has no product behind it, so it inherits the longest
  // validity the admin currently offers - the same rule create_gift_card_purchase
  // applies server-side.
  const customValidityDays = products.length
    ? Math.max(...products.map((p) => p.validity_days))
    : 365;
  const customValue = Number(customAmount);
  const customValid =
    customAmount.trim() !== "" &&
    Number.isFinite(customValue) &&
    customValue >= MIN_GIFT_CARD_AMOUNT;

  const amount = customMode
    ? customValid
      ? customValue
      : null
    : (selectedProduct?.price ?? null);
  const validityDays = customMode
    ? customValidityDays
    : (selectedProduct?.validity_days ?? null);

  function chooseProduct(product: GiftCardProduct) {
    setCustomMode(false);
    setSelectedProduct(product);
  }

  function chooseCustom() {
    setCustomMode(true);
    setSelectedProduct(null);
  }

  async function handleSubmit() {
    if (amount == null) return;
    setSubmitting(true);
    setError(null);
    const input = {
      product_id: customMode ? null : selectedProduct?.id,
      amount: customMode ? amount : null,
      design_slug: selectedDesign.slug,
      purchaser_name: purchaserName,
      purchaser_email: purchaserEmail,
      purchaser_phone: purchaserPhone,
      recipient_name: recipientName || undefined,
      recipient_email: recipientEmail || undefined,
      message: message || undefined,
    };
    try {
      if (paymentMode === "stripe") {
        const { url } = await createGiftCardCheckoutSession(input);
        window.location.href = url;
      } else {
        const { giftCardId } = await createGiftCardSimple(input);
        router.push(`/gift-cards/confirmation?gift_card_id=${giftCardId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
            {n < 2 && (
              <div
                className={`h-px w-10 ${step > n ? "bg-brand-600" : "bg-gray-300"}`}
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">
            Choose a Design
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Pick the card the recipient will see in their email.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GIFT_CARD_DESIGNS.map((design) => {
              const active = selectedDesign.slug === design.slug;
              return (
                <button
                  key={design.slug}
                  type="button"
                  onClick={() => setSelectedDesign(design)}
                  aria-pressed={active}
                  className={`group overflow-hidden rounded-xl ring-2 transition ${
                    active
                      ? "ring-brand-600"
                      : "ring-transparent hover:ring-gray-300"
                  }`}
                >
                  <span className="relative block aspect-[8/5] w-full">
                    <Image
                      src={design.image}
                      alt={design.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    {active && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                        <svg
                          width="14"
                          height="14"
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
                    )}
                  </span>
                  <span
                    className={`block px-3 py-2 text-center text-sm font-medium ${
                      active ? "text-brand-700" : "text-gray-700"
                    }`}
                  >
                    {design.name}
                  </span>
                </button>
              );
            })}
          </div>

          <h2 className="mb-1 mt-8 text-lg font-semibold text-gray-900">
            Choose an Amount
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Pick one of ours or enter your own &mdash; gift cards start at $
            {MIN_GIFT_CARD_AMOUNT}.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => chooseProduct(p)}
                className={`rounded-lg border p-4 text-left ${
                  !customMode && selectedProduct?.id === p.id
                    ? "border-brand-600 bg-brand-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <div className="text-xl font-bold text-brand-600">
                  ${p.price.toFixed(2)}
                </div>
                {p.description && (
                  <div className="mt-1 text-xs text-gray-500">{p.description}</div>
                )}
                <div className="mt-2 text-xs text-gray-400">
                  Valid for {p.validity_days} days
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={chooseCustom}
              className={`rounded-lg border p-4 text-left ${
                customMode
                  ? "border-brand-600 bg-brand-50"
                  : "border-dashed border-gray-300 hover:border-gray-400"
              }`}
            >
              <div className="text-xl font-bold text-brand-600">Other</div>
              <div className="mt-1 text-xs text-gray-500">Choose your own amount</div>
              <div className="mt-2 text-xs text-gray-400">
                Valid for {customValidityDays} days
              </div>
            </button>
          </div>

          {customMode && (
            <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/50 p-4">
              <label
                htmlFor="custom-gift-card-amount"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Enter your amount
              </label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-500">$</span>
                <input
                  id="custom-gift-card-amount"
                  type="number"
                  inputMode="decimal"
                  min={MIN_GIFT_CARD_AMOUNT}
                  step={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={String(MIN_GIFT_CARD_AMOUNT)}
                  className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              {customAmount.trim() !== "" && !customValid && (
                <p className="mt-2 text-xs text-red-600">
                  The minimum gift card amount is ${MIN_GIFT_CARD_AMOUNT}.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              disabled={amount == null}
              onClick={() => setStep(2)}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && amount != null && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Details</h2>

          <div className="mb-4 flex items-center gap-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            <span className="relative block aspect-[8/5] w-28 shrink-0 overflow-hidden rounded-md">
              <Image
                src={selectedDesign.image}
                alt={selectedDesign.name}
                fill
                sizes="112px"
                className="object-cover"
              />
            </span>
            <span className="flex-1">
              <span className="flex justify-between font-medium text-gray-900">
                <span>{selectedDesign.name} gift card</span>
                <span>${amount.toFixed(2)}</span>
              </span>
              <span className="mt-1 block text-xs">
                Valid for {validityDays} days from purchase
              </span>
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Your details</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Full name
              </label>
              <input
                required
                value={purchaserName}
                onChange={(e) => setPurchaserName(e.target.value)}
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
                value={purchaserEmail}
                onChange={(e) => setPurchaserEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                required
                value={purchaserPhone}
                onChange={(e) => setPurchaserPhone(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <p className="pt-2 text-sm font-medium text-gray-700">
              Sending as a gift? (optional)
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Recipient name
              </label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Recipient email
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Leave blank to send to yourself"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {paymentMode === "stripe" ? (
            <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Pay securely with Stripe
              </p>
              <p className="mt-1 text-sm text-blue-700">
                You&apos;ll be taken to Stripe&apos;s secure checkout to pay{" "}
                <strong>${amount.toFixed(2)}</strong> by card.
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
                Your gift card code will be emailed to you now — payment is
                collected in person, not now.
              </p>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-600"
            >
              Previous
            </button>
            <button
              disabled={!purchaserName || !purchaserEmail || !purchaserPhone || submitting}
              onClick={handleSubmit}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {submitting
                ? paymentMode === "stripe"
                  ? "Redirecting to Stripe..."
                  : "Processing..."
                : paymentMode === "stripe"
                  ? `Continue to Payment — $${amount.toFixed(2)}`
                  : `Buy Gift Card — $${amount.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
