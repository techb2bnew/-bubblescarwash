"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GiftCardProduct } from "@/lib/types";
import { createGiftCardProduct, updateGiftCardProduct, type GiftCardProductInput } from "./actions";

export default function GiftCardProductForm({
  product,
  onDone,
}: {
  product?: GiftCardProduct;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<GiftCardProductInput>({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price ?? 0,
    validity_days: product?.validity_days ?? 90,
    sort_order: product?.sort_order ?? 0,
    active: product?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: GiftCardProductInput = {
        ...form,
        description: form.description?.trim() ? form.description.trim() : null,
      };
      if (product) {
        await updateGiftCardProduct(product.id, input);
      } else {
        await createGiftCardProduct(input);
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
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Gift card name
        </label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. $50 Gift Card"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Description (optional)
        </label>
        <textarea
          value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Shown on the gift card purchase page"
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Price ($)
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            required
            value={form.price}
            onChange={(e) =>
              setForm({ ...form, price: Math.max(0, Number(e.target.value) || 0) })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Validity (days)
          </label>
          <input
            type="number"
            min={1}
            required
            value={form.validity_days}
            onChange={(e) =>
              setForm({
                ...form,
                validity_days: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Sort order
          </label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) =>
              setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
          className="h-4 w-4 accent-brand-600"
        />
        Visible to customers
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : product ? "Update Gift Card" : "Add Gift Card"}
      </button>
    </form>
  );
}
