"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Discount, DiscountType } from "@/lib/types";
import { createDiscount, updateDiscount } from "./actions";
import type { CustomerOption } from "./discounts-page-client";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return result;
}

export default function DiscountForm({
  discount,
  customers,
  onDone,
}: {
  discount?: Discount;
  customers: CustomerOption[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<"customer" | "code">(
    discount?.customer_id ? "customer" : "code",
  );
  const [customerId, setCustomerId] = useState(discount?.customer_id ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [code, setCode] = useState(discount?.code ?? "");
  const [name, setName] = useState(discount?.name ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(
    discount?.discount_type ?? "percent",
  );
  const [value, setValue] = useState(discount?.value ?? 10);
  const [maxRedemptions, setMaxRedemptions] = useState(
    discount?.max_redemptions?.toString() ?? "",
  );
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    discount?.per_customer_limit?.toString() ?? "",
  );
  const [expiresAt, setExpiresAt] = useState(
    discount?.expires_at ? discount.expires_at.slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCustomers = customerSearch.trim()
    ? customers.filter((c) => {
        const q = customerSearch.trim().toLowerCase();
        return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
      })
    : customers;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (target === "customer" && !customerId) {
      setError("Select a customer.");
      return;
    }
    if (target === "code" && !code.trim()) {
      setError("Enter or generate a code.");
      return;
    }
    if (discountType === "percent" && value > 100) {
      setError("A percentage discount can't exceed 100%.");
      return;
    }

    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        discount_type: discountType,
        value,
        code: target === "code" ? code.trim().toUpperCase() : null,
        customer_id: target === "customer" ? customerId : null,
        max_redemptions: maxRedemptions.trim() ? parseInt(maxRedemptions, 10) : null,
        per_customer_limit:
          target === "code" && perCustomerLimit.trim() ? parseInt(perCustomerLimit, 10) : null,
        expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      };
      if (discount) {
        await updateDiscount(discount.id, input);
      } else {
        await createDiscount(input);
      }
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Label</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Loyal customer 10% or Spring Sale"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Applies to</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["customer", "One customer"],
              ["code", "Coupon code"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setTarget(v)}
              className={`rounded-md border px-2 py-1.5 text-sm font-medium ${
                target === v
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {target === "customer" ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Customer</label>
          {customers.length === 0 ? (
            <p className="text-xs text-gray-400">
              No customers yet — they&apos;re added automatically after their first booking.
            </p>
          ) : (
            <>
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="mb-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select a customer...</option>
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email || c.phone})
                  </option>
                ))}
              </select>
            </>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Applied automatically the next time this customer books — no code needed.
          </p>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Coupon code</label>
          <div className="flex gap-2">
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SAVE20"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase"
            />
            <button
              type="button"
              onClick={() => setCode(randomCode())}
              className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Generate
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Discount type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed amount off</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            {discountType === "percent" ? "Percent (%)" : "Amount ($)"}
          </label>
          <input
            required
            type="number"
            min={0}
            max={discountType === "percent" ? 100 : undefined}
            step={discountType === "percent" ? 1 : 0.01}
            value={value}
            onChange={(e) => setValue(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Max total uses
          </label>
          <input
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Unlimited"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Expires</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {target === "code" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Max uses per customer
          </label>
          <input
            type="number"
            min={1}
            value={perCustomerLimit}
            onChange={(e) => setPerCustomerLimit(e.target.value)}
            placeholder="Unlimited"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      {discount && (
        <p className="text-xs text-gray-400">
          Used {discount.redemption_count} time{discount.redemption_count === 1 ? "" : "s"} so far.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : discount ? "Update Discount" : "Add Discount"}
      </button>
    </form>
  );
}
