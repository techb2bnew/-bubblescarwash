"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AddOn, CategoryRow, ServiceCategory } from "@/lib/types";
import { createAddOn, updateAddOn, type AddOnInput } from "./actions";

export default function AddOnForm({
  addOn,
  categories,
  defaultCategory,
  onDone,
}: {
  addOn?: AddOn;
  categories: CategoryRow[];
  defaultCategory?: ServiceCategory;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AddOnInput>({
    name: addOn?.name ?? "",
    category: addOn?.category ?? defaultCategory ?? categories[0]?.slug ?? "",
    sort_order: addOn?.sort_order ?? 0,
    active: addOn?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (addOn) {
        await updateAddOn(addOn.id, form);
      } else {
        await createAddOn(form);
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
          Add-on name
        </label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. High-pressure rinse"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as ServiceCategory })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
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
        {saving ? "Saving..." : addOn ? "Update Add-On" : "Add Add-On"}
      </button>
    </form>
  );
}
