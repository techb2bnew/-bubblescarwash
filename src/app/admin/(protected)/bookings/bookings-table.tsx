"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockedDate, Booking, BookingStatus, BusinessSettings } from "@/lib/types";
import { rescheduleBooking, setBookingStatus } from "./actions";
import StatusDropdown from "./status-dropdown";
import AddOnsBadge from "./add-ons-badge";
import ExtrasBadge from "./extras-badge";
import PaymentStatusBadge from "./payment-status-badge";
import RescheduleModal from "./reschedule-modal";
import { FilterSelect, TableToolbar } from "../_components/table-toolbar";
import { SortHeader } from "../_components/sort-header";
import { Pagination } from "../_components/pagination";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "cancelled", label: "Cancelled" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];

export default function BookingsTable({
  bookings,
  blockedDates,
  settings,
}: {
  bookings: Booking[];
  blockedDates: BlockedDate[];
  settings: BusinessSettings;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("booking_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);

  const bookingCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      counts[b.booking_date] = (counts[b.booking_date] ?? 0) + 1;
    }
    return counts;
  }, [bookings]);

  const typeCounts = useMemo(() => {
    let online = 0;
    let offline = 0;
    for (const b of bookings) {
      if (b.booking_type === "offline") offline += 1;
      else online += 1;
    }
    return { online, offline };
  }, [bookings]);

  async function handleStatusChange(id: string, newStatus: BookingStatus) {
    await setBookingStatus(id, newStatus);
    router.refresh();
  }

  async function handleReschedule(date: string, time: string) {
    if (!rescheduling) return;
    await rescheduleBooking(rescheduling.id, date, time);
    router.refresh();
    setRescheduling(null);
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
    let result = bookings;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(q) ||
          b.customer_phone.toLowerCase().includes(q) ||
          b.customer_email.toLowerCase().includes(q),
      );
    }
    if (status !== "all") result = result.filter((b) => b.status === status);
    if (type !== "all") result = result.filter((b) => b.booking_type === type);
    if (dateFrom) result = result.filter((b) => b.booking_date >= dateFrom);
    if (dateTo) result = result.filter((b) => b.booking_date <= dateTo);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortKey === "customer_name") {
          av = a.customer_name.toLowerCase();
          bv = b.customer_name.toLowerCase();
        } else if (sortKey === "price") {
          av = a.price ?? 0;
          bv = b.price ?? 0;
        } else {
          av = `${a.booking_date} ${a.booking_time}`;
          bv = `${b.booking_date} ${b.booking_time}`;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [bookings, search, status, type, dateFrom, dateTo, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (clampedPage - 1) * PAGE_SIZE,
    clampedPage * PAGE_SIZE,
  );

  const hasActiveFilters =
    search.trim() !== "" ||
    status !== "all" ||
    type !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setType("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gray-400" /> Online:{" "}
          <span className="font-semibold text-gray-700">{typeCounts.online}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Offline:{" "}
          <span className="font-semibold text-gray-700">{typeCounts.offline}</span>
        </span>
      </div>
      <TableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search name, phone, email..."
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
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
        <FilterSelect
          label="Type"
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={TYPE_OPTIONS}
        />
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label="From date"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <span>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label="To date"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </TableToolbar>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader
                label="Date"
                sortKey="booking_date"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">Time</th>
              <SortHeader
                label="Customer"
                sortKey="customer_name"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Inclusions</th>
              <th className="px-4 py-3">Add-Ons</th>
              <SortHeader
                label="Amount"
                sortKey="price"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {b.booking_date}
                </td>
                <td className="px-4 py-3 text-gray-600">{b.booking_time}</td>
                <td className="px-4 py-3 text-gray-900">{b.customer_name}</td>
                <td className="px-4 py-3 text-gray-600">
                  <div>{b.customer_phone}</div>
                  <div className="text-xs text-gray-400">{b.customer_email}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {b.services ? (
                    <>
                      {b.services.name}
                      <div className="text-xs uppercase tracking-wide text-gray-400">
                        {b.vehicle_type}
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <AddOnsBadge
                    names={(b.services?.inclusions ?? [])
                      .filter((i) => i.active)
                      .map((i) => i.name)}
                  />
                </td>
                <td className="px-4 py-3">
                  <ExtrasBadge extras={b.booking_extras ?? []} />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {b.price != null ? `$${b.price.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge
                    paymentStatus={b.payment_status}
                    bookingType={b.booking_type}
                  />
                  {b.card_brand && b.card_last4 && (
                    <div className="mt-1 text-xs text-gray-400">
                      <span className="capitalize">{b.card_brand}</span> •••• {b.card_last4}
                      {b.receipt_url && (
                        <>
                          {" · "}
                          <a
                            href={b.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Receipt
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusDropdown
                    value={b.status}
                    onChange={(newStatus) => handleStatusChange(b.id, newStatus)}
                  />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      b.booking_type === "offline"
                        ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                        : "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200"
                    }`}
                  >
                    {b.booking_type === "offline" ? "Offline" : "Online"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setRescheduling(b)}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-700"
                  >
                    Reschedule
                  </button>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-gray-400">
                  {bookings.length === 0
                    ? "No bookings yet."
                    : "No bookings match your search/filters."}
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

      {rescheduling && (
        <RescheduleModal
          booking={rescheduling}
          settings={settings}
          blockedDates={blockedDates}
          bookingCountByDate={bookingCountByDate}
          onConfirm={handleReschedule}
          onClose={() => setRescheduling(null)}
        />
      )}
    </div>
  );
}
