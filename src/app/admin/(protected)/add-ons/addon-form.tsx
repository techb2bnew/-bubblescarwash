"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createServiceAddOn, updateServiceAddOn } from "../services/actions";
import type { AddOnWithService, ServiceOption } from "./addons-page-client";

export default function AddOnForm({
  addOn,
  services,
  onDone,
}: {
  addOn?: AddOnWithService;
  services: ServiceOption[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(addOn?.service_id ?? services[0]?.id ?? "");
  const [name, setName] = useState(addOn?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId) return;
    setSaving(true);
    setError(null);
    try {
      if (addOn) {
        await updateServiceAddOn(addOn.id, name, addOn.sort_order);
      } else {
        await createServiceAddOn(serviceId, name, 0);
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
        <label className="mb-1 block text-xs font-medium text-gray-600">Service</label>
        <select
          required
          value={serviceId}
          disabled={Boolean(addOn)}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
        >
          {services.length === 0 && <option value="">No services yet</option>}
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {addOn && (
          <p className="mt-1 text-xs text-gray-400">
            An inclusion can&apos;t be moved to a different service — delete and re-add it under
            the right one instead.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Interior Vacuum"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving || !serviceId}
        className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : addOn ? "Update Inclusion" : "Add Inclusion"}
      </button>
    </form>
  );
}
