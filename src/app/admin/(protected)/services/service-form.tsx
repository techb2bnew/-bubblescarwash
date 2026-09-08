"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AddOn, ServiceCategoryRow, ServicePrice, ServiceTemplate, VehicleTypeRow } from "@/lib/types";
import {
  createServiceAddOn,
  createServicePrice,
  createServiceTemplate,
  deleteServiceAddOn,
  deleteServicePrice,
  toggleServiceAddOnActive,
  updateServiceAddOn,
  updateServicePrice,
  updateServiceTemplate,
} from "./actions";
import { useToast } from "../_components/toast";

export default function ServiceForm({
  service,
  vehicleTypes,
  categories,
  allServices,
  onDone,
}: {
  service?: ServiceTemplate;
  vehicleTypes: VehicleTypeRow[];
  categories: ServiceCategoryRow[];
  allServices: ServiceTemplate[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const showToast = useToast();
  const activeVehicleTypes = vehicleTypes.filter((v) => v.active);
  const activeCategories = categories.filter((c) => c.active);

  const [name, setName] = useState(service?.name ?? "");
  const [categoryId, setCategoryId] = useState(
    service?.category_id ?? activeCategories[0]?.id ?? "",
  );
  const [durationMinutes, setDurationMinutes] = useState(service?.duration_minutes ?? 30);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create mode: check several vehicle types, one price each — creates the
  // template plus one service_prices row per vehicle type checked, all
  // sharing this same name/duration/add-ons.
  const [vehiclePrices, setVehiclePrices] = useState<Record<string, string>>({});

  // Edit mode: an existing template's price rows, managed live (same
  // pattern as add-ons below) since a real service id already exists.
  const [prices, setPrices] = useState<ServicePrice[]>(service?.prices ?? []);
  const [newPriceVehicle, setNewPriceVehicle] = useState("");
  const [newPriceValue, setNewPriceValue] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceBusy, setPriceBusy] = useState(false);

  const [addOns, setAddOns] = useState<AddOn[]>(service?.inclusions ?? []);
  const [newAddOnName, setNewAddOnName] = useState("");
  const [existingAddOnPick, setExistingAddOnPick] = useState("");
  const [addOnError, setAddOnError] = useState<string | null>(null);
  const [addOnBusy, setAddOnBusy] = useState(false);

  // Every distinct inclusion name already used on another service, so one
  // can be reused here instead of retyping it — excludes names already on
  // this service.
  const currentAddOnNames = new Set(addOns.map((a) => a.name.toLowerCase()));
  const existingAddOnNames: string[] = [];
  const seenAddOnNames = new Set<string>();
  for (const s of allServices) {
    for (const a of s.inclusions ?? []) {
      const key = a.name.toLowerCase();
      if (seenAddOnNames.has(key) || currentAddOnNames.has(key)) continue;
      seenAddOnNames.add(key);
      existingAddOnNames.push(a.name);
    }
  }
  existingAddOnNames.sort((a, b) => a.localeCompare(b));

  const pricedVehicleTypes = new Set(prices.map((p) => p.vehicle_type));
  const unpricedVehicleTypes = activeVehicleTypes.filter((v) => !pricedVehicleTypes.has(v.slug));

  function toggleVehicle(slug: string, checked: boolean) {
    setVehiclePrices((prev) => {
      const next = { ...prev };
      if (checked) next[slug] = next[slug] ?? "";
      else delete next[slug];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!categoryId) {
        setError("Select a category.");
        return;
      }
      if (service) {
        await updateServiceTemplate(service.id, {
          name,
          category_id: categoryId,
          duration_minutes: durationMinutes,
        });
        router.refresh();
        showToast("Service updated.");
        onDone?.();
      } else {
        const entries = Object.entries(vehiclePrices).filter(([, price]) => price.trim() !== "");
        if (entries.length === 0) {
          setError("Select at least one vehicle type and enter a price.");
          return;
        }

        const { id } = await createServiceTemplate({
          name,
          category_id: categoryId,
          duration_minutes: durationMinutes,
        });
        for (const [vehicleType, priceStr] of entries) {
          await createServicePrice(id, vehicleType, parseFloat(priceStr));
        }
        for (let i = 0; i < addOns.length; i++) {
          await createServiceAddOn(id, addOns[i].name, i);
        }
        router.refresh();
        showToast("Service created.");
        onDone?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPrice() {
    if (!service || !newPriceVehicle || !newPriceValue.trim()) return;
    setPriceBusy(true);
    setPriceError(null);
    try {
      const price = parseFloat(newPriceValue);
      const { id } = await createServicePrice(service.id, newPriceVehicle, price);
      setPrices((prev) => [...prev, { id, service_id: service.id, vehicle_type: newPriceVehicle, price }]);
      setNewPriceVehicle("");
      setNewPriceValue("");
      router.refresh();
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPriceBusy(false);
    }
  }

  async function handleChangePrice(priceRow: ServicePrice, value: string) {
    const price = Number(value) || 0;
    setPrices((prev) => prev.map((p) => (p.id === priceRow.id ? { ...p, price } : p)));
    try {
      await updateServicePrice(priceRow.id, price);
      router.refresh();
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleDeletePrice(priceRow: ServicePrice) {
    setPrices((prev) => prev.filter((p) => p.id !== priceRow.id));
    try {
      await deleteServicePrice(priceRow.id);
      router.refresh();
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  /** While creating, add-ons are staged locally and only saved once the
   * template is created; once editing an existing service, each change
   * hits the server immediately since a real service id already exists. */
  async function handleAddAddOn(nameOverride?: string) {
    const name = (nameOverride ?? newAddOnName).trim();
    if (!name) return;

    if (!service) {
      setAddOns((prev) => [
        ...prev,
        { id: crypto.randomUUID(), service_id: "", name, sort_order: prev.length, active: true },
      ]);
      setNewAddOnName("");
      setExistingAddOnPick("");
      return;
    }

    setAddOnBusy(true);
    setAddOnError(null);
    try {
      const { id } = await createServiceAddOn(service.id, name, addOns.length);
      setAddOns((prev) => [
        ...prev,
        { id, service_id: service.id, name, sort_order: prev.length, active: true },
      ]);
      setNewAddOnName("");
      setExistingAddOnPick("");
      router.refresh();
    } catch (err) {
      setAddOnError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAddOnBusy(false);
    }
  }

  async function handleRenameAddOn(addOn: AddOn, name: string) {
    setAddOns((prev) => prev.map((a) => (a.id === addOn.id ? { ...a, name } : a)));
    if (!service) return;
    try {
      await updateServiceAddOn(addOn.id, name, addOn.sort_order);
      router.refresh();
    } catch (err) {
      setAddOnError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleToggleAddOn(addOn: AddOn) {
    const active = !addOn.active;
    setAddOns((prev) => prev.map((a) => (a.id === addOn.id ? { ...a, active } : a)));
    if (!service) return;
    try {
      await toggleServiceAddOnActive(addOn.id, active);
      router.refresh();
    } catch (err) {
      setAddOnError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleDeleteAddOn(addOn: AddOn) {
    setAddOns((prev) => prev.filter((a) => a.id !== addOn.id));
    if (!service) return;
    try {
      await deleteServiceAddOn(addOn.id);
      router.refresh();
    } catch (err) {
      setAddOnError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const vehicleName = (slug: string) => vehicleTypes.find((v) => v.slug === slug)?.name ?? slug;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Express Wash"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
        {activeCategories.length === 0 ? (
          <p className="text-xs text-gray-400">
            No categories yet — add one on the Categories page first.
          </p>
        ) : (
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Vehicle Types &amp; Prices
        </label>

        {service ? (
          <>
            {prices.length > 0 && (
              <div className="mb-2 rounded-md border border-gray-200">
                {prices.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-2 ${i > 0 ? "border-t border-gray-100" : ""}`}
                  >
                    <span className="flex-1 text-sm text-gray-700">{vehicleName(p.vehicle_type)}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.price}
                      onChange={(e) => handleChangePrice(p, e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeletePrice(p)}
                      aria-label="Remove vehicle type"
                      className="text-red-600 hover:text-red-700"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {unpricedVehicleTypes.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={newPriceVehicle}
                  onChange={(e) => setNewPriceVehicle(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-2 text-sm"
                >
                  <option value="">Add vehicle type...</option>
                  {unpricedVehicleTypes.map((v) => (
                    <option key={v.id} value={v.slug}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price"
                  value={newPriceValue}
                  onChange={(e) => setNewPriceValue(e.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-2 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddPrice}
                  disabled={priceBusy || !newPriceVehicle || !newPriceValue.trim()}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  + Add
                </button>
              </div>
            )}
            {priceError && <p className="mt-1 text-sm text-red-600">{priceError}</p>}
          </>
        ) : (
          <>
            {activeVehicleTypes.length === 0 ? (
              <p className="text-xs text-gray-400">No vehicle types yet.</p>
            ) : (
              <div className="space-y-2 rounded-md border border-gray-200 p-3">
                {activeVehicleTypes.map((v) => {
                  const checked = v.slug in vehiclePrices;
                  return (
                    <div key={v.id} className="flex items-center gap-2">
                      <label className="flex flex-1 items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleVehicle(v.slug, e.target.checked)}
                          className="h-4 w-4 accent-brand-600"
                        />
                        {v.name}
                      </label>
                      {checked && (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Price"
                          value={vehiclePrices[v.slug]}
                          onChange={(e) =>
                            setVehiclePrices((prev) => ({ ...prev, [v.slug]: e.target.value }))
                          }
                          className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              One service, priced per vehicle type checked — all sharing this name, duration,
              and inclusions.
            </p>
          </>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Duration (mins)</label>
        <input
          required
          type="number"
          min="5"
          step="5"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <label className="mb-1 block text-xs font-medium text-gray-600">Inclusions</label>
        {!service && (
          <p className="mb-2 text-xs text-gray-400">
            Inclusions entered here are saved together with the service below.
          </p>
        )}
        {addOns.length > 0 && (
          <div className="mb-2 max-h-48 overflow-y-auto rounded-md border border-gray-200">
            {addOns.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center gap-2 px-3 py-2 ${i > 0 ? "border-t border-gray-100" : ""}`}
              >
                <input
                  value={a.name}
                  onChange={(e) => handleRenameAddOn(a, e.target.value)}
                  className={`flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm ${a.active ? "" : "text-gray-400"}`}
                />
                {service && (
                  <button
                    type="button"
                    onClick={() => handleToggleAddOn(a)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.active
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                        : "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
                    }`}
                  >
                    {a.active ? "Visible" : "Hidden"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteAddOn(a)}
                  aria-label="Delete inclusion"
                  className="text-red-600 hover:text-red-700"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        {existingAddOnNames.length > 0 && (
          <div className="mb-2 flex gap-2">
            <select
              value={existingAddOnPick}
              onChange={(e) => setExistingAddOnPick(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="">Add from existing inclusions...</option>
              {existingAddOnNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAddAddOn(existingAddOnPick)}
              disabled={addOnBusy || !existingAddOnPick}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              + Add
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newAddOnName}
            onChange={(e) => setNewAddOnName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddAddOn();
              }
            }}
            placeholder="e.g. Interior Vacuum"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => handleAddAddOn()}
            disabled={addOnBusy || !newAddOnName.trim()}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        {addOnError && <p className="mt-1 text-sm text-red-600">{addOnError}</p>}
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
