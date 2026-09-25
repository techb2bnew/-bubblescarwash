"use client";

import { useState } from "react";
import { MODULES } from "@/lib/permission-modules";
import type { ModuleKey, StaffPermission } from "@/lib/types";
import { setStaffPermission } from "../actions";
import { useToast } from "../../_components/toast";

type Column = "can_view" | "can_create" | "can_edit" | "can_delete";
const COLUMN_LABELS: Record<Column, string> = {
  can_view: "View",
  can_create: "Create",
  can_edit: "Edit",
  can_delete: "Delete",
};

export default function StaffPermissionsTable({
  userId,
  initialPermissions,
}: {
  userId: string;
  initialPermissions: Record<ModuleKey, StaffPermission>;
}) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const showToast = useToast();

  async function toggle(module: ModuleKey, column: Column) {
    const next = !permissions[module][column];
    const cellKey = `${module}:${column}`;
    setSavingKey(cellKey);
    setPermissions((prev) => ({ ...prev, [module]: { ...prev[module], [column]: next } }));
    try {
      await setStaffPermission(userId, module, { [column]: next });
    } catch (err) {
      // Roll back on failure.
      setPermissions((prev) => ({ ...prev, [module]: { ...prev[module], [column]: !next } }));
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Module</th>
            {(Object.keys(COLUMN_LABELS) as Column[]).map((col) => (
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
                {(Object.keys(COLUMN_LABELS) as Column[]).map((col) => {
                  const applicable = col === "can_view" || mod.actions.includes(col.replace("can_", "") as never);
                  const cellKey = `${mod.key}:${col}`;
                  return (
                    <td key={col} className="px-4 py-3 text-center">
                      {applicable ? (
                        <input
                          type="checkbox"
                          checked={perm[col]}
                          disabled={savingKey === cellKey}
                          onChange={() => toggle(mod.key, col)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                        />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
