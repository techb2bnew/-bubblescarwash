"use client";

import { useState } from "react";
import Link from "next/link";
import type { AddOn } from "@/lib/types";
import AddOnsTable from "./addons-table";
import AddOnForm from "./addon-form";

export type AddOnWithService = AddOn & { services: { id: string; name: string } | null };
export type ServiceOption = { id: string; name: string };

export default function AddOnsPageClient({
  addOns,
  services,
}: {
  addOns: AddOnWithService[];
  services: ServiceOption[];
}) {
  const [modal, setModal] = useState<"new" | AddOnWithService | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Add-Ons</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every add-on across all services. Each one belongs to exactly one
            service — you can also manage a service&apos;s own add-ons from
            inside its edit form on the Services page.
          </p>
        </div>
        <button
          onClick={() => setModal("new")}
          disabled={services.length === 0}
          title={services.length === 0 ? "Add a service first — an add-on must belong to one" : undefined}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          + Add Add-On
        </button>
      </div>

      {services.length === 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You don&apos;t have any services yet — add one on the{" "}
          <Link href="/admin/services" className="font-medium underline">
            Services
          </Link>{" "}
          page first, since every add-on has to belong to one.
        </p>
      )}

      <AddOnsTable addOns={addOns} services={services} onEdit={(a) => setModal(a)} />

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
                {modal === "new" ? "Add an add-on" : "Edit add-on"}
              </h2>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="text-xl leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <AddOnForm
              addOn={modal === "new" ? undefined : modal}
              services={services}
              onDone={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
