"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryRow, Service, VehicleTypeRow } from "@/lib/types";
import { deleteService, toggleServiceActive } from "./actions";
import { FilterSelect, TableToolbar } from "../_components/table-toolbar";
import { SortHeader } from "../_components/sort-header";
import { Pagination } from "../_components/pagination";
import { useConfirmDialog } from "../_components/confirm-dialog";

const PAGE_SIZE = 10;

const ACTIVE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function ServicesTable({
  services,
  vehicleTypes,
  categories,
  onEdit,
}: {
  services: Service[];
  vehicleTypes: VehicleTypeRow[];
  categories: CategoryRow[];
  onEdit: (service: Service) => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...categories.map((c) => ({ value: c.slug, label: c.name })),
  ];
  const vehicleOptions = [
    { value: "all", label: "All Vehicles" },
    ...vehicleTypes.map((v) => ({ value: v.slug, label: v.name })),
  ];
  const categoryNameBySlug = new Map(categories.map((c) => [c.slug, c.name]));
  const vehicleNameBySlug = new Map(vehicleTypes.map((v) => [v.slug, v.name]));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [vehicle, setVehicle] = useState("all");
  const [active, setActive] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this service? This cannot be undone."))) return;
    await deleteService(id);
    router.refresh();
  }

  async function handleToggle(service: Service) {
    await toggleServiceActive(service.id, !service.active);
    router.refresh();
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
    if (category !== "all") result = result.filter((s) => s.category === category);
    if (vehicle !== "all") result = result.filter((s) => s.vehicle_type === vehicle);
    if (active === "active") result = result.filter((s) => s.active);
    if (active === "inactive") result = result.filter((s) => !s.active);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortKey === "name") {
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
        } else if (sortKey === "price") {
          av = a.price;
          bv = b.price;
        } else {
          av = a.duration_minutes;
          bv = b.duration_minutes;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [services, search, category, vehicle, active, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (clampedPage - 1) * PAGE_SIZE,
    clampedPage * PAGE_SIZE,
  );

  const hasActiveFilters =
    search.trim() !== "" || category !== "all" || vehicle !== "all" || active !== "all";

  function clearFilters() {
    setSearch("");
    setCategory("all");
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
          label="Category"
          value={category}
          onChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
          options={categoryOptions}
        />
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
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Vehicle</th>
              <SortHeader
                label="Price"
                sortKey="price"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
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
                <td className="px-4 py-3 capitalize text-gray-600">
                  {categoryNameBySlug.get(s.category) ?? s.category}
                </td>
                <td className="px-4 py-3 uppercase tracking-wide text-gray-600">
                  {vehicleNameBySlug.get(s.vehicle_type) ?? s.vehicle_type}
                </td>
                <td className="px-4 py-3 text-gray-600">${s.price.toFixed(2)}</td>
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
                <td className="space-x-3 px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(s)}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
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
