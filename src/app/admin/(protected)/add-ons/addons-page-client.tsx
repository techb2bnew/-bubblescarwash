"use client";

import { useState } from "react";
import type { AddOn, CategoryRow, ServiceCategory } from "@/lib/types";
import AddOnsTable from "./addons-table";
import AddOnForm from "./addon-form";

export default function AddOnsPageClient({
  addOns,
  categories,
}: {
  addOns: AddOn[];
  categories: CategoryRow[];
}) {
  const [tab, setTab] = useState<ServiceCategory>(categories[0]?.slug ?? "");
  const [modal, setModal] = useState<"new" | AddOn | null>(null);

  const visibleAddOns = addOns.filter((a) => a.category === tab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Add-Ons</h1>
          <p className="mt-1 text-sm text-gray-500">
            The feature checklist shown on each service&apos;s comparison table.
          </p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Add-On
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setTab(c.slug)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === c.slug
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <AddOnsTable addOns={visibleAddOns} onEdit={(a) => setModal(a)} />

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
              categories={categories}
              defaultCategory={tab}
              onDone={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
