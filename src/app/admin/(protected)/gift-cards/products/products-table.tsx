"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GiftCardProduct } from "@/lib/types";
import { deleteGiftCardProduct, toggleGiftCardProductActive } from "./actions";
import { FilterSelect, TableToolbar } from "../../_components/table-toolbar";
import { SortHeader } from "../../_components/sort-header";
import { Pagination } from "../../_components/pagination";
import { useConfirmDialog } from "../../_components/confirm-dialog";

const PAGE_SIZE = 10;
const VISIBILITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
];

export default function GiftCardProductsTable({
  products,
  onEdit,
}: {
  products: GiftCardProduct[];
  onEdit: (product: GiftCardProduct) => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("sort_order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this gift card? This cannot be undone."))) return;
    await deleteGiftCardProduct(id);
    router.refresh();
  }

  async function handleToggle(product: GiftCardProduct) {
    await toggleGiftCardProductActive(product.id, !product.active);
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
    let result = products;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((p) => p.name.toLowerCase().includes(q));
    if (visibility === "visible") result = result.filter((p) => p.active);
    if (visibility === "hidden") result = result.filter((p) => !p.active);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av =
          sortKey === "name"
            ? a.name.toLowerCase()
            : sortKey === "price"
              ? a.price
              : a.sort_order;
        const bv =
          sortKey === "name"
            ? b.name.toLowerCase()
            : sortKey === "price"
              ? b.price
              : b.sort_order;
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [products, search, visibility, sortKey, sortDir]);

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
        searchPlaceholder="Search gift cards..."
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
                label="Gift Card"
                sortKey="name"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Price"
                sortKey="price"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="w-24"
              />
              <th className="w-28 px-4 py-3">Validity</th>
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
            {paged.map((p) => (
              <tr
                key={p.id}
                className={`hover:bg-gray-50/60 ${p.active ? "" : "opacity-50"}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-gray-500">{p.description}</div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  ${p.price.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-gray-500">{p.validity_days} days</td>
                <td className="px-4 py-3 text-gray-500">{p.sort_order}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(p)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      p.active
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                        : "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
                    }`}
                  >
                    {p.active ? "Visible" : "Hidden"}
                  </button>
                </td>
                <td className="space-x-3 px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(p)}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  {products.length === 0
                    ? 'No gift cards yet — click "Add Gift Card" to create one.'
                    : "No gift cards match your search/filters."}
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
