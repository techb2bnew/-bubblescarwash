"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerSummary } from "@/lib/types";
import { TableToolbar } from "../_components/table-toolbar";
import { SortHeader } from "../_components/sort-header";
import { Pagination } from "../_components/pagination";
import { useConfirmDialog } from "../_components/confirm-dialog";
import { EditButton, DeleteButton, ViewButton } from "../_components/action-icons";
import { deleteCustomer } from "./actions";
import CustomerForm from "./customer-form";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  completed: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200",
  cancelled: "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200",
};

export default function CustomersPageClient({
  customers,
}: {
  customers: CustomerSummary[];
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("lastVisit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomerSummary | null>(null);
  const [modal, setModal] = useState<"new" | CustomerSummary | null>(null);

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this customer? Their booking history is kept, but they'll drop off this list."))) return;
    await deleteCustomer(id);
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
    let result = customers;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      );
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortKey === "name") {
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
        } else if (sortKey === "bookingsCount") {
          av = a.bookingsCount;
          bv = b.bookingsCount;
        } else if (sortKey === "totalSpent") {
          av = a.totalSpent;
          bv = b.totalSpent;
        } else {
          av = a.lastVisit;
          bv = b.lastVisit;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [customers, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (clampedPage - 1) * PAGE_SIZE,
    clampedPage * PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Everyone who has made a booking, with their history.
          </p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Customer
        </button>
      </div>

      <div className="space-y-3">
        <TableToolbar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search name, phone, email..."
          hasActiveFilters={search.trim() !== ""}
          onClear={() => {
            setSearch("");
            setPage(1);
          }}
        />

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
                <th className="px-4 py-3">Contact</th>
                <SortHeader
                  label="Bookings"
                  sortKey="bookingsCount"
                  currentSort={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Total Spent"
                  sortKey="totalSpent"
                  currentSort={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Last Visit"
                  sortKey="lastVisit"
                  currentSort={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((c) => (
                <tr key={c.key} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{c.phone}</div>
                    <div className="text-xs text-gray-400">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.bookingsCount}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ${c.totalSpent.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.lastVisit || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ViewButton onClick={() => setSelected(c)} label="View history" />
                      {c.id && (
                        <>
                          <EditButton onClick={() => setModal(c)} label="Edit customer" />
                          <DeleteButton onClick={() => handleDelete(c.id!)} label="Delete customer" />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {customers.length === 0
                      ? "No customers yet."
                      : "No customers match your search."}
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

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {selected.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selected.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selected.phone} · {selected.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6 18 18M6 18 18 6" />
                </svg>
              </button>
            </div>

            <div className="max-h-[calc(85vh-88px)] overflow-y-auto px-6 py-5">
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-inset ring-gray-200">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 7h8M8 13h8" />
                    </svg>
                  </span>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {selected.bookingsCount}
                    </div>
                    <div className="text-xs text-gray-500">Total bookings</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-inset ring-gray-200">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </span>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${selected.totalSpent.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">Total spent</div>
                  </div>
                </div>
              </div>

              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Booking History
              </h3>
              <div className="space-y-2">
                {selected.bookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 4h6l5 5.5a2 2 0 0 1 0 2.8L14.3 18a2 2 0 0 1-2.8 0L5 11.5V6a2 2 0 0 1 2-2Z" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">
                        {b.services?.name ?? "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {b.booking_date} at {b.booking_time.slice(0, 5)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-medium text-gray-900">
                        {b.price != null ? `$${b.price.toFixed(2)}` : "—"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[b.status] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {modal === "new" ? "Add a customer" : "Edit customer"}
              </h2>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="text-xl leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <CustomerForm
              customer={modal === "new" ? undefined : modal}
              onDone={() => setModal(null)}
            />
          </div>
        </div>
      )}

      {dialog}
    </div>
  );
}
