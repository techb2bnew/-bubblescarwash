"use client";

import { useState } from "react";
import type { Extra } from "@/lib/types";
import ExtrasTable from "./extras-table";
import ExtraForm from "./extra-form";

export default function ExtrasPageClient({ extras }: { extras: Extra[] }) {
  const [modal, setModal] = useState<"new" | Extra | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Extras</h1>
          <p className="mt-1 text-sm text-gray-500">
            Optional priced add-ons customers can select during booking, after
            choosing a date and time.
          </p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Extra
        </button>
      </div>

      <ExtrasTable extras={extras} onEdit={(e) => setModal(e)} />

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
                {modal === "new" ? "Add an extra" : "Edit extra"}
              </h2>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="text-xl leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <ExtraForm
              extra={modal === "new" ? undefined : modal}
              onDone={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
