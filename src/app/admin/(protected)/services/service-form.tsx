"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AddOn,
  CategoryRow,
  Service,
  ServiceCategory,
  VehicleType,
  VehicleTypeRow,
} from "@/lib/types";
import { createService, updateService, type ServiceInput } from "./actions";

export default function ServiceForm({
  service,
  inclusions,
  vehicleTypes,
  categories,
  onDone,
}: {
  service?: Service;
  inclusions: AddOn[];
  vehicleTypes: VehicleTypeRow[];
  categories: CategoryRow[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const activeVehicleTypes = vehicleTypes.filter((v) => v.active);
  const activeCategories = categories.filter((c) => c.active);

  const [form, setForm] = useState<ServiceInput>({
    name: service?.name ?? "",
    category: service?.category ?? activeCategories[0]?.slug ?? "",
    vehicle_type: service?.vehicle_type ?? activeVehicleTypes[0]?.slug ?? "",
    price: service?.price ?? 0,
    discount_percent: service?.discount_percent ?? 0,
    discount_active: service?.discount_active ?? false,
    duration_minutes: service?.duration_minutes ?? 30,
  });
  const [selectedInclusionIds, setSelectedInclusionIds] = useState<Set<string>>(
    () => new Set(service?.service_inclusions?.map((si) => si.inclusion_id) ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCategoryChange(category: ServiceCategory) {
    setForm({ ...form, category });
    setSelectedInclusionIds(new Set());
  }

  function toggleInclusion(id: string) {
    setSelectedInclusionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const inclusionIds = Array.from(selectedInclusionIds);
      if (service) {
        await updateService(service.id, form, inclusionIds);
      } else {
        await createService(form, inclusionIds);
      }
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const categoryInclusions = inclusions.filter((i) => i.category === form.category);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Express Wash"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
          <select
            value={form.category}
            onChange={(e) => handleCategoryChange(e.target.value as ServiceCategory)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {activeCategories.length === 0 && (
              <option value="">No categories yet</option>
            )}
            {activeCategories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Vehicle</label>
          <select
            value={form.vehicle_type}
            onChange={(e) =>
              setForm({ ...form, vehicle_type: e.target.value as VehicleType })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {activeVehicleTypes.length === 0 && (
              <option value="">No vehicle types yet</option>
            )}
            {activeVehicleTypes.map((v) => (
              <option key={v.id} value={v.slug}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Price ($)</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Duration (mins)</label>
          <input
            required
            type="number"
            min="5"
            step="5"
            value={form.duration_minutes}
            onChange={(e) =>
              setForm({ ...form, duration_minutes: parseInt(e.target.value, 10) })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-md border border-gray-200 p-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.discount_active}
            onChange={(e) => setForm({ ...form, discount_active: e.target.checked })}
            className="h-4 w-4 accent-brand-600"
          />
          Discount active
        </label>
        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Discount (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={form.discount_percent}
            onChange={(e) =>
              setForm({
                ...form,
                discount_percent: Math.min(
                  100,
                  Math.max(0, Number(e.target.value) || 0),
                ),
              })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {form.discount_active && form.discount_percent > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              ${form.price.toFixed(2)} → $
              {(form.price * (1 - form.discount_percent / 100)).toFixed(2)}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Add-Ons ({form.category})
        </label>
        {categoryInclusions.length === 0 ? (
          <p className="text-xs text-gray-400">
            No add-ons defined for this category yet — add some on the
            Add-Ons page.
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200">
            {categoryInclusions.map((inc, i) => (
              <label
                key={inc.id}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-brand-50 ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedInclusionIds.has(inc.id)}
                  onChange={() => toggleInclusion(inc.id)}
                  className="h-4 w-4 accent-brand-600"
                />
                {inc.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : service ? "Update Service" : "Add Service"}
      </button>
    </form>
  );
}
