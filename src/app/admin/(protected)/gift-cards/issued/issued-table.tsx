"use client";

import { useMemo, useState } from "react";
import type { GiftCard } from "@/lib/types";
import { FilterSelect, TableToolbar } from "../../_components/table-toolbar";
import { SortHeader } from "../../_components/sort-header";
import { Pagination } from "../../_components/pagination";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "used", label: "Used" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

type DisplayStatus = "pending" | "active" | "used" | "expired" | "cancelled";

function displayStatus(card: GiftCard): DisplayStatus {
  if (card.status === "active" && new Date(card.expires_at) < new Date()) {
    return "expired";
  }
  return card.status;
}

const STATUS_STYLES: Record<DisplayStatus, string> = {
  pending: "bg-gray-100 text-gray-500 ring-gray-200",
  active: "bg-green-50 text-green-700 ring-green-200",
  used: "bg-blue-50 text-blue-700 ring-blue-200",
  expired: "bg-amber-50 text-amber-700 ring-amber-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

export default function IssuedTable({ cards }: { cards: GiftCard[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

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
    let result = cards;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.purchaser_email.toLowerCase().includes(q) ||
          (c.recipient_email ?? "").toLowerCase().includes(q),
      );
    }
    if (status !== "all") {
      result = result.filter((c) => displayStatus(c) === status);
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av =
          sortKey === "value"
            ? a.value
            : sortKey === "code"
              ? a.code
              : a.created_at;
        const bv =
          sortKey === "value"
            ? b.value
            : sortKey === "code"
              ? b.code
              : b.created_at;
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [cards, search, status, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (clampedPage - 1) * PAGE_SIZE,
    clampedPage * PAGE_SIZE,
  );

  const hasActiveFilters = search.trim() !== "" || status !== "all";

  return (
    <div className="space-y-3">
      <TableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search code or email..."
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setStatus("all");
          setPage(1);
        }}
      >
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
        />
      </TableToolbar>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader
                label="Code"
                sortKey="code"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">Purchaser</th>
              <th className="px-4 py-3">Recipient</th>
              <SortHeader
                label="Value"
                sortKey="value"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="w-24"
              />
              <th className="w-28 px-4 py-3">Status</th>
              <th className="px-4 py-3">Redeemed booking</th>
              <SortHeader
                label="Purchased"
                sortKey="created_at"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="w-32"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((c) => {
              const ds = displayStatus(c);
              return (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                    {c.code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{c.purchaser_name}</div>
                    <div className="text-xs text-gray-500">{c.purchaser_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {c.recipient_email ? (
                      <>
                        <div className="text-gray-900">
                          {c.recipient_name || c.recipient_email}
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.recipient_email}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Self</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ${c.value.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[ds]}`}
                    >
                      {ds}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {c.redeemed_booking_id ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  {cards.length === 0
                    ? "No gift cards have been purchased yet."
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
    </div>
  );
}
