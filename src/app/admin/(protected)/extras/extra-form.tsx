"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Extra } from "@/lib/types";
import { createExtra, updateExtra, type ExtraInput } from "./actions";

export default function ExtraForm({
  extra,
  onDone,
}: {
  extra?: Extra;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ExtraInput>({
    name: extra?.name ?? "",
    description: extra?.description ?? "",
    price: extra?.price ?? 0,
    sort_order: extra?.sort_order ?? 0,
    active: extra?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: ExtraInput = {
        ...form,
        description: form.description?.trim() ? form.description.trim() : null,
      };
      if (extra) {
        await updateExtra(extra.id, input);
      } else {
        await createExtra(input);
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
          Extra name
        </label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Mag wheel detail & polish"
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
          placeholder="Shown under the name during booking"
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        {saving ? "Saving..." : extra ? "Update Extra" : "Add Extra"}
      </button>
    </form>
  );
}
