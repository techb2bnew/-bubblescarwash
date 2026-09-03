"use client";

import { useState } from "react";
import type { GiftCardProduct } from "@/lib/types";
import GiftCardProductsTable from "./products-table";
import GiftCardProductForm from "./product-form";

export default function ProductsPanel({ products }: { products: GiftCardProduct[] }) {
  const [modal, setModal] = useState<"new" | GiftCardProduct | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setModal("new")}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Gift Card
        </button>
      </div>

      <GiftCardProductsTable products={products} onEdit={(p) => setModal(p)} />

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
                {modal === "new" ? "Add a gift card" : "Edit gift card"}
              </h2>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="text-xl leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <GiftCardProductForm
              product={modal === "new" ? undefined : modal}
              onDone={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
