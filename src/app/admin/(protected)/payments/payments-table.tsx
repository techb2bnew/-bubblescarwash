"use client";

import { useMemo, useState } from "react";
import type { BookingType, PaymentStatus } from "@/lib/types";
import { formatDateLong } from "@/lib/date-utils";
import PaymentStatusBadge from "../bookings/payment-status-badge";
import { FilterSelect, TableToolbar } from "../_components/table-toolbar";
import { SortHeader } from "../_components/sort-header";
import { Pagination } from "../_components/pagination";

export interface PaymentRecord {
  id: string;
  type: "booking" | "gift_card";
  date: string;
  name: string;
  email: string;
  description: string;
  amount: number | null;
  paymentStatus: PaymentStatus;
  bookingType: BookingType;
  cardBrand: string | null;
  cardLast4: string | null;
  receiptUrl: string | null;
}

const PAGE_SIZE = 15;
const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "booking", label: "Bookings" },
  { value: "gift_card", label: "Gift Cards" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "unpaid", label: "Unpaid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

export default function PaymentsTable({ records }: { records: PaymentRecord[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("date");
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
    let result = records;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }
    if (type !== "all") result = result.filter((r) => r.type === type);
    if (status !== "all") result = result.filter((r) => r.paymentStatus === status);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = sortKey === "amount" ? (a.amount ?? 0) : a.date;
        const bv = sortKey === "amount" ? (b.amount ?? 0) : b.date;
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [records, search, type, status, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const totalPaid = useMemo(
    () =>
      filtered
        .filter((r) => r.paymentStatus === "paid")
        .reduce((sum, r) => sum + (r.amount ?? 0), 0),
    [filtered],
  );

  const hasActiveFilters = search.trim() !== "" || type !== "all" || status !== "all";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm ring-1 ring-black/[0.03]">
        <div className="text-xs font-medium text-gray-500">
          Total paid {hasActiveFilters ? "(filtered)" : ""}
        </div>
        <div className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
          ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <TableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search name, email, or service..."
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setType("all");
          setStatus("all");
          setPage(1);
        }}
      >
        <FilterSelect
          label="Type"
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={TYPE_OPTIONS}
        />
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

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm ring-1 ring-black/[0.03]">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader
                label="Date"
                sortKey="date"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="w-32"
              />
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Description</th>
              <SortHeader
                label="Amount"
                sortKey="amount"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="w-24"
              />
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((r) => (
              <tr key={`${r.type}-${r.id}`} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 text-xs text-gray-500">
                  {formatDateLong(r.date.slice(0, 10))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.type === "gift_card"
                        ? "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200"
                        : "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                    }`}
                  >
                    {r.type === "gift_card" ? "Gift Card" : "Booking"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{r.description}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {r.amount != null ? `$${r.amount.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge
                    paymentStatus={r.paymentStatus}
                    bookingType={r.bookingType}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {r.cardBrand && r.cardLast4 ? (
                    <div>
                      <span className="capitalize">{r.cardBrand}</span> •••• {r.cardLast4}
                      {r.receiptUrl && (
                        <>
                          {" · "}
                          <a
                            href={r.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Receipt
                          </a>
                        </>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                  {records.length === 0
                    ? "No payments yet."
                    : "No payments match your search/filters."}
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
