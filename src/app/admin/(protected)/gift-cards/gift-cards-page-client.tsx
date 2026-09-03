"use client";

import { useState } from "react";
import type { GiftCard, GiftCardProduct } from "@/lib/types";
import ProductsPanel from "./products/products-panel";
import IssuedTable from "./issued/issued-table";

type Tab = "products" | "issued";

export default function GiftCardsPageClient({
  products,
  cards,
}: {
  products: GiftCardProduct[];
  cards: GiftCard[];
}) {
  const [tab, setTab] = useState<Tab>("products");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Gift Cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage purchasable gift card denominations and view issued codes.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            { key: "products", label: "Products" },
            { key: "issued", label: "Issued Cards" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <ProductsPanel products={products} />
      ) : (
        <IssuedTable cards={cards} />
      )}
    </div>
  );
}
