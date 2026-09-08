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

interface AddOnGroup {
  name: string;
  instances: AddOnWithService[];
}

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
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this inclusion? This cannot be undone."))) return;
    try {
      await deleteServiceAddOn(id);
      router.refresh();
      showToast("Inclusion deleted.");
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

  function handleSort() {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  const groups = useMemo(() => {
    let result = addOns;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((a) => a.name.toLowerCase().includes(q));
    if (service !== "all") result = result.filter((a) => a.service_id === service);
    if (visibility === "visible") result = result.filter((a) => a.active);
    if (visibility === "hidden") result = result.filter((a) => !a.active);

    const byName = new Map<string, AddOnGroup>();
    for (const a of result) {
      const key = a.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (existing) existing.instances.push(a);
      else byName.set(key, { name: a.name, instances: [a] });
    }

    return Array.from(byName.values()).sort((a, b) =>
      sortDir === "asc"
        ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        : b.name.toLowerCase().localeCompare(a.name.toLowerCase()),
    );
  }, [addOns, search, service, visibility, sortDir]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paged = groups.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

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
        searchPlaceholder="Search inclusions..."
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
                label="Inclusion"
                sortKey="name"
                currentSort="name"
                currentDir={sortDir}
                onSort={handleSort}
              />
              <th className="px-4 py-3">Used On</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((g) => (
              <tr key={g.name.toLowerCase()} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {g.instances.map((instance) => (
                      <div
                        key={instance.id}
                        className={`inline-flex items-center gap-0.5 rounded-full py-1 pl-2.5 pr-1 text-xs font-medium ${
                          instance.active
                            ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
                            : "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggle(instance)}
                          title={instance.active ? "Visible — click to hide" : "Hidden — click to show"}
                          className="hover:underline"
                        >
                          {instance.services?.name ?? "—"}
                        </button>
                        <EditButton onClick={() => onEdit(instance)} />
                        <DeleteButton onClick={() => handleDelete(instance.id)} />
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-gray-400">
                  {addOns.length === 0
                    ? 'No inclusions yet — click "Add Inclusion" to create one.'
                    : "No inclusions match your search/filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={clampedPage}
          totalPages={totalPages}
          totalItems={groups.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
      {dialog}
    </div>
  );
}
