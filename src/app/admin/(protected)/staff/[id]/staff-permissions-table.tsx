"use client";

import { useState } from "react";
import { MODULES } from "@/lib/permission-modules";
import type { ModuleKey, StaffPermission } from "@/lib/types";
import { saveStaffPermissions } from "../actions";
import { useToast } from "../../_components/toast";

type Column = "can_view" | "can_create" | "can_edit" | "can_delete";
const COLUMNS: Column[] = ["can_view", "can_create", "can_edit", "can_delete"];
const COLUMN_LABELS: Record<Column, string> = {
  can_view: "View",
  can_create: "Create",
  can_edit: "Edit",
  can_delete: "Delete",
};

type Permissions = Record<ModuleKey, StaffPermission>;

function isApplicable(mod: (typeof MODULES)[number], col: Column) {
  return col === "can_view" || mod.actions.includes(col.replace("can_", "") as never);
}

function snapshot(p: Permissions) {
  return JSON.stringify(
    MODULES.map((m) => COLUMNS.map((c) => (isApplicable(m, c) ? p[m.key][c] : false))),
  );
}

export default function StaffPermissionsTable({
  userId,
  initialPermissions,
}: {
  userId: string;
  initialPermissions: Permissions;
}) {
  const [saved, setSaved] = useState(initialPermissions);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  const dirty = snapshot(permissions) !== snapshot(saved);
  const allSelected = MODULES.every((m) =>
    COLUMNS.every((c) => !isApplicable(m, c) || permissions[m.key][c]),
  );

  function toggle(module: ModuleKey, column: Column) {
    setPermissions((prev) => ({
      ...prev,
      [module]: { ...prev[module], [column]: !prev[module][column] },
    }));
  }

  function toggleAll() {
    const next = !allSelected;
    setPermissions((prev) => {
      const out = { ...prev };
      for (const m of MODULES) {
        const row = { ...prev[m.key] };
        for (const c of COLUMNS) {
          if (isApplicable(m, c)) row[c] = next;
        }
        out[m.key] = row;
      }
      return out;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await saveStaffPermissions(userId, permissions);
      setSaved(permissions);
      showToast("Permissions saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleAll}
          disabled={saving}
          className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {allSelected ? "Unselect all" : "Select all"}
        </button>
        <div className="flex items-center gap-3">
          {dirty && !saving && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Module</th>
              {COLUMNS.map((col) => (
                <th key={col} className="px-4 py-3 text-center">
                  {COLUMN_LABELS[col]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {MODULES.map((mod) => {
              const perm = permissions[mod.key];
              return (
                <tr key={mod.key}>
                  <td className="px-4 py-3 font-medium text-gray-900">{mod.label}</td>
                  {COLUMNS.map((col) => (
                    <td key={col} className="px-4 py-3 text-center">
                      {isApplicable(mod, col) ? (
                        <input
                          type="checkbox"
                          checked={perm[col]}
                          disabled={saving}
                          onChange={() => toggle(mod.key, col)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                        />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
