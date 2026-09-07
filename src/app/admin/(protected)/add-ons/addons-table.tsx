"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AddOnWithService, ServiceOption } from "./addons-page-client";
import { deleteServiceAddOn, toggleServiceAddOnActive } from "../services/actions";
import { FilterSelect, TableToolbar } from "../_components/table-toolbar";
import { SortHeader } from "../_components/sort-header";
import { Pagination } from "../_components/pagination";
import { useConfirmDialog } from "../_components/confirm-dialog";
import { EditButton, DeleteButton } from "../_components/action-icons";
import { useToast } from "../_components/toast";

const PAGE_SIZE = 10;
const VISIBILITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

export default function AddOnsTable({
  addOns,
  services,
  onEdit,
}: {
  addOns: AddOnWithService[];
  services: ServiceOption[];
  onEdit: (addOn: AddOnWithService) => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const showToast = useToast();

  const serviceOptions = [
    { value: "all", label: "All Services" },
    ...services.map((s) => ({ value: s.id, label: s.name })),
  ];
  const [search, setSearch] = useState("");
  const [service, setService] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this add-on? This cannot be undone."))) return;
    try {
      await deleteServiceAddOn(id);
      router.refresh();
      showToast("Add-on deleted.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function handleToggle(addOn: AddOnWithService) {
    try {
      await toggleServiceAddOnActive(addOn.id, !addOn.active);
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
    let result = addOns;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((a) => a.name.toLowerCase().includes(q));
    if (service !== "all") result = result.filter((a) => a.service_id === service);
    if (visibility === "visible") result = result.filter((a) => a.active);
    if (visibility === "hidden") result = result.filter((a) => !a.active);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av =
          sortKey === "name" ? a.name.toLowerCase() : (a.services?.name.toLowerCase() ?? "");
        const bv =
          sortKey === "name" ? b.name.toLowerCase() : (b.services?.name.toLowerCase() ?? "");
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [addOns, search, service, visibility, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const hasActiveFilters = search.trim() !== "" || service !== "all" || visibility !== "all";

  function clearFilters() {
    setSearch("");
    setService("all");
    setVisibility("all");
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
        searchPlaceholder="Search add-ons..."
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      >
        <FilterSelect
          label="Service"
          value={service}
          onChange={(v) => {
            setService(v);
            setPage(1);
          }}
          options={serviceOptions}
        />
        <FilterSelect
          label="Visibility"
          value={visibility}
          onChange={(v) => {
            setVisibility(v);
            setPage(1);
          }}
          options={VISIBILITY_OPTIONS}
        />
      </TableToolbar>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader
                label="Add-On"
                sortKey="name"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Service"
                sortKey="service"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="w-28 px-4 py-3">Visible</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((a) => (
              <tr key={a.id} className={`hover:bg-gray-50/60 ${a.active ? "" : "opacity-50"}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                <td className="px-4 py-3 text-gray-600">{a.services?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(a)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      a.active
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                        : "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
                    }`}
                  >
                    {a.active ? "Visible" : "Hidden"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditButton onClick={() => onEdit(a)} />
                    <DeleteButton onClick={() => handleDelete(a.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                  {addOns.length === 0
                    ? 'No add-ons yet — click "Add Add-On" to create one.'
                    : "No add-ons match your search/filters."}
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
