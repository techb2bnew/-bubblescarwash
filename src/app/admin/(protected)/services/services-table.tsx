"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ServiceTemplate, VehicleTypeRow } from "@/lib/types";
import { computeEffectivePrice } from "@/lib/pricing";
import { deleteServiceTemplate, toggleServiceActive } from "./actions";
import { FilterSelect, TableToolbar } from "../_components/table-toolbar";
import { SortHeader } from "../_components/sort-header";
import { Pagination } from "../_components/pagination";
import { useConfirmDialog } from "../_components/confirm-dialog";
import { EditButton, DeleteButton } from "../_components/action-icons";
import { useToast } from "../_components/toast";

const PAGE_SIZE = 10;

const ACTIVE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function ServicesTable({
  services,
  vehicleTypes,
  onEdit,
}: {
  services: ServiceTemplate[];
  vehicleTypes: VehicleTypeRow[];
  onEdit: (service: ServiceTemplate) => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const showToast = useToast();

  const vehicleOptions = [
    { value: "all", label: "All Vehicles" },
    ...vehicleTypes.map((v) => ({ value: v.slug, label: v.name })),
  ];
  const vehicleNameBySlug = new Map(vehicleTypes.map((v) => [v.slug, v.name]));
  const [search, setSearch] = useState("");
  const [vehicle, setVehicle] = useState("all");
  const [active, setActive] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this service? This cannot be undone."))) return;
    try {
      await deleteServiceTemplate(id);
      router.refresh();
      showToast("Service deleted.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function handleToggle(service: ServiceTemplate) {
    try {
      await toggleServiceActive(service.id, !service.active);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    let result = services;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((s) => s.name.toLowerCase().includes(q));
    if (vehicle !== "all") {
      result = result.filter((s) => s.prices.some((p) => p.vehicle_type === vehicle));
    }
    if (active === "active") result = result.filter((s) => s.active);
    if (active === "inactive") result = result.filter((s) => !s.active);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = sortKey === "name" ? a.name.toLowerCase() : a.duration_minutes;
        const bv = sortKey === "name" ? b.name.toLowerCase() : b.duration_minutes;
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [services, search, vehicle, active, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (clampedPage - 1) * PAGE_SIZE,
    clampedPage * PAGE_SIZE,
  );

  const hasActiveFilters = search.trim() !== "" || vehicle !== "all" || active !== "all";

  function clearFilters() {
    setSearch("");
    setVehicle("all");
    setActive("all");
    setPage(1);
  }

  return (
    <div className="space-y-3">
      <TableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search services..."
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      >
        <FilterSelect
          label="Vehicle"
          value={vehicle}
          onChange={(v) => {
            setVehicle(v);
            setPage(1);
          }}
          options={vehicleOptions}
        />
        <FilterSelect
          label="Active"
          value={active}
          onChange={(v) => {
            setActive(v);
            setPage(1);
          }}
          options={ACTIVE_OPTIONS}
        />
      </TableToolbar>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader
                label="Name"
                sortKey="name"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">Vehicle Prices</th>
              <SortHeader
                label="Duration"
                sortKey="duration_minutes"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {s.prices.length === 0 ? (
                      <span className="text-xs text-gray-400">No prices set</span>
                    ) : (
                      s.prices.map((p) => {
                        const effective = computeEffectivePrice(
                          p.price,
                          s.discount_percent,
                          s.discount_active,
                        );
                        return (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                          >
                            <span className="uppercase tracking-wide text-gray-500">
                              {vehicleNameBySlug.get(p.vehicle_type) ?? p.vehicle_type}
                            </span>
                            {s.discount_active && s.discount_percent > 0 ? (
                              <>
                                <span className="text-gray-400 line-through">
                                  ${p.price.toFixed(2)}
                                </span>
                                <span className="font-medium text-green-700">
                                  ${effective.toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="font-medium text-gray-900">
                                ${p.price.toFixed(2)}
                              </span>
                            )}
                          </span>
                        );
                      })
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.duration_minutes} min</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.active
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                        : "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
                    }`}
                  >
                    {s.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditButton onClick={() => onEdit(s)} />
                    <DeleteButton onClick={() => handleDelete(s.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  {services.length === 0
                    ? 'No services yet — click "Add Service" to create one.'
                    : "No services match your search/filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={clampedPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
      {dialog}
    </div>
  );
}
