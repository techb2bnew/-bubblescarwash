"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AddOn } from "@/lib/types";
import { deleteAddOn, toggleAddOnActive } from "./actions";
import { FilterSelect, TableToolbar } from "../_components/table-toolbar";
import { SortHeader } from "../_components/sort-header";
import { Pagination } from "../_components/pagination";
import { useConfirmDialog } from "../_components/confirm-dialog";

const PAGE_SIZE = 10;
const VISIBILITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

export default function AddOnsTable({
  addOns,
  onEdit,
}: {
  addOns: AddOn[];
  onEdit: (addOn: AddOn) => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("sort_order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this add-on? This cannot be undone."))) return;
    await deleteAddOn(id);
    router.refresh();
  }

  async function handleToggle(addOn: AddOn) {
    await toggleAddOnActive(addOn.id, !addOn.active);
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
    let result = addOns;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((a) => a.name.toLowerCase().includes(q));
    if (visibility === "visible") result = result.filter((a) => a.active);
    if (visibility === "hidden") result = result.filter((a) => !a.active);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = sortKey === "name" ? a.name.toLowerCase() : a.sort_order;
        const bv = sortKey === "name" ? b.name.toLowerCase() : b.sort_order;
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [addOns, search, visibility, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (clampedPage - 1) * PAGE_SIZE,
    clampedPage * PAGE_SIZE,
  );

  const hasActiveFilters = search.trim() !== "" || visibility !== "all";

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
        onClear={() => {
          setSearch("");
          setVisibility("all");
          setPage(1);
        }}
      >
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
                label="Order"
                sortKey="sort_order"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="w-20"
              />
              <th className="w-28 px-4 py-3">Visible</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((a) => (
              <tr
                key={a.id}
                className={`hover:bg-gray-50/60 ${a.active ? "" : "opacity-50"}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                <td className="px-4 py-3 text-gray-500">{a.sort_order}</td>
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
                <td className="space-x-3 px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(a)}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
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
