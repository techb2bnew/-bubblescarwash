"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SimpleEntity } from "./entity-form";
import { FilterSelect, TableToolbar } from "./table-toolbar";
import { SortHeader } from "./sort-header";
import { Pagination } from "./pagination";
import { useConfirmDialog } from "./confirm-dialog";
import { EditButton, DeleteButton } from "./action-icons";

const PAGE_SIZE = 10;
const ACTIVE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function EntityTable({
  entities,
  entityLabel,
  entityLabelPlural,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  entities: SimpleEntity[];
  entityLabel: string;
  entityLabelPlural: string;
  onEdit: (entity: SimpleEntity) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (id: string, active: boolean) => Promise<void>;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("all");
  const [sortKey, setSortKey] = useState<string | null>("sort_order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  async function handleDelete(id: string) {
    const ok = await confirm(
      `Delete this ${entityLabel.toLowerCase()}? This cannot be undone.`,
    );
    if (!ok) return;
    await onDelete(id);
    router.refresh();
  }

  async function handleToggle(entity: SimpleEntity) {
    await onToggleActive(entity.id, !entity.active);
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
    let result = entities;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) => e.name.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q),
      );
    }
    if (active === "active") result = result.filter((e) => e.active);
    if (active === "inactive") result = result.filter((e) => !e.active);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortKey === "name") {
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
        } else {
          av = a.sort_order;
          bv = b.sort_order;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [entities, search, active, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (clampedPage - 1) * PAGE_SIZE,
    clampedPage * PAGE_SIZE,
  );

  const hasActiveFilters = search.trim() !== "" || active !== "all";

  return (
    <div className="space-y-3">
      <TableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder={`Search ${entityLabelPlural.toLowerCase()}...`}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearch("");
          setActive("all");
          setPage(1);
        }}
      >
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
              <th className="px-4 py-3">Slug</th>
              <SortHeader
                label="Order"
                sortKey="sort_order"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className="w-20"
              />
              <th className="w-28 px-4 py-3">Active</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((e) => (
              <tr
                key={e.id}
                className={`hover:bg-gray-50/60 ${e.active ? "" : "opacity-50"}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {e.slug}
                </td>
                <td className="px-4 py-3 text-gray-500">{e.sort_order}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(e)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      e.active
                        ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                        : "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
                    }`}
                  >
                    {e.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditButton onClick={() => onEdit(e)} />
                    <DeleteButton onClick={() => handleDelete(e.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  {entities.length === 0
                    ? `No ${entityLabelPlural.toLowerCase()} yet.`
                    : "No results match your search/filters."}
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
