"use client";

import { useState } from "react";
import type { Customer, Discount } from "@/lib/types";
import DiscountsTable from "./discounts-table";
import DiscountForm from "./discount-form";

export type CustomerOption = Pick<Customer, "id" | "name" | "phone" | "email">;

export default function DiscountsPageClient({
  discounts,
  customers,
}: {
  discounts: Discount[];
  customers: CustomerOption[];
}) {
  const [modal, setModal] = useState<"new" | Discount | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Discounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Give a discount to a specific customer (applied automatically when they
            book) or generate a coupon code anyone can redeem, with optional
            redemption limits and an expiry date.
          </p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Discount
        </button>
      </div>

      <DiscountsTable discounts={discounts} onEdit={(d) => setModal(d)} />

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
                {modal === "new" ? "Add a discount" : "Edit discount"}
              </h2>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="text-xl leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <DiscountForm
              discount={modal === "new" ? undefined : modal}
              customers={customers}
              onDone={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
