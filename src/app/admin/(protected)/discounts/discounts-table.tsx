"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Discount } from "@/lib/types";
import { deleteDiscount, toggleDiscountActive } from "./actions";
import { FilterSelect, TableToolbar } from "../_components/table-toolbar";
import { SortHeader } from "../_components/sort-header";
import { Pagination } from "../_components/pagination";
import { useConfirmDialog } from "../_components/confirm-dialog";
import { EditButton, DeleteButton } from "../_components/action-icons";
import { useToast } from "../_components/toast";

const PAGE_SIZE = 10;

const TARGET_OPTIONS = [
  { value: "all", label: "All" },
  { value: "customer", label: "Customer" },
  { value: "code", label: "Coupon code" },
];

const VISIBILITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function formatValue(d: Discount): string {
  return d.discount_type === "percent" ? `${d.value}% off` : `$${d.value.toFixed(2)} off`;
}

function isExpired(d: Discount): boolean {
  return Boolean(d.expires_at && new Date(d.expires_at) < new Date());
}

export default function DiscountsTable({
  discounts,
  onEdit,
}: {
  discounts: Discount[];
  onEdit: (discount: Discount) => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const showToast = useToast();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this discount? This cannot be undone."))) return;
    try {
      await deleteDiscount(id);
      router.refresh();
      showToast("Discount deleted.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
  }

  async function handleToggle(discount: Discount) {
    try {
      await toggleDiscountActive(discount.id, !discount.active);
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
    let result = discounts;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.code ?? "").toLowerCase().includes(q) ||
          (d.customers?.name ?? "").toLowerCase().includes(q),
      );
    }
    if (target === "customer") result = result.filter((d) => d.customer_id !== null);
    if (target === "code") result = result.filter((d) => d.code !== null);
    if (visibility === "active") result = result.filter((d) => d.active);
    if (visibility === "inactive") result = result.filter((d) => !d.active);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = sortKey === "name" ? a.name.toLowerCase() : a.created_at;
        const bv = sortKey === "name" ? b.name.toLowerCase() : b.created_at;
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [discounts, search, target, visibility, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const hasActiveFilters = search.trim() !== "" || target !== "all" || visibility !== "all";

  function clearFilters() {
    setSearch("");
    setTarget("all");
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
        searchPlaceholder="Search name, code, or customer..."
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      >
        <FilterSelect
          label="Applies to"
          value={target}
          onChange={(v) => {
            setTarget(v);
            setPage(1);
          }}
          options={TARGET_OPTIONS}
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
                label="Name"
                sortKey="name"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">Applies To</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Redemptions</th>
              <th className="px-4 py-3">Expires</th>
              <th className="w-28 px-4 py-3">Active</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((d) => (
              <tr key={d.id} className={`hover:bg-gray-50/60 ${d.active ? "" : "opacity-50"}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {d.customer_id ? (
                    <span>{d.customers?.name ?? "Customer"}</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-700">
                      {d.code}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{formatValue(d)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {d.redemption_count}
                  {d.max_redemptions != null ? ` / ${d.max_redemptions}` : ""}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {d.expires_at ? (
                    <span className={isExpired(d) ? "text-red-600" : ""}>
                      {new Date(d.expires_at).toLocaleDateString()}
                    </span>
                  ) : (
                    "Never"
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(d)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      d.active
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                        : "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
                    }`}
                  >
                    {d.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditButton onClick={() => onEdit(d)} />
                    <DeleteButton onClick={() => handleDelete(d.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  {discounts.length === 0
                    ? 'No discounts yet — click "Add Discount" to create one.'
                    : "No discounts match your search/filters."}
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
