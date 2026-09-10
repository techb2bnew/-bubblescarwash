"use client";

import { useState } from "react";
import Link from "next/link";
import type { ServiceCategoryRow, VehicleTypeRow } from "@/lib/types";
import { normalizeTitleCase } from "@/lib/format";
import { getCategoryIcon } from "./category-icon";

type Tier = {
  name: string;
  category_id: string;
  duration_minutes: number;
  prices: { vehicleTypeSlug: string; price: number }[];
  features: string[];
};

export default function PackagesTabs({
  categories,
  tiers,
  vehicleTypes,
}: {
  categories: ServiceCategoryRow[];
  tiers: Tier[];
  vehicleTypes: VehicleTypeRow[];
}) {
  const availableCategories = categories.filter((c) =>
    tiers.some((t) => t.category_id === c.id),
  );
  const [activeCategory, setActiveCategory] = useState<string>(
    availableCategories[0]?.id ?? "",
  );

  const activeTiers = tiers.filter((t) => t.category_id === activeCategory);

  if (availableCategories.length === 0) return null;

  return (
    <div>
      {availableCategories.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {availableCategories.map((c) => {
            const active = activeCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {getCategoryIcon(c.name)}
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {activeTiers.map((tier, idx) => {
          const featured = activeTiers.length > 1 && idx === Math.floor((activeTiers.length - 1) / 2);
          return (
            <div
              key={tier.name}
              className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                featured
                  ? "border-brand-300 shadow-lg shadow-brand-600/10 ring-2 ring-brand-500 sm:-translate-y-2"
                  : "border-gray-100"
              }`}
            >
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-50" />
              {featured && (
                <span className="absolute right-4 top-4 rounded-full bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Most Popular
                </span>
              )}
              <div className="relative">
                <h4 className="text-base font-bold text-gray-900">{normalizeTitleCase(tier.name)}</h4>
              </div>

              {tier.features.length > 0 && (
                <ul className="relative mt-4 space-y-1.5 text-sm text-gray-600">
                  {tier.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="mt-0.5 text-brand-500">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="relative mt-5 flex-1 space-y-1 border-t border-gray-100 pt-4">
                {tier.prices.map((p, i) => {
                  const vt = vehicleTypes.find((v) => v.slug === p.vehicleTypeSlug);
                  return (
                    <p
                      key={p.vehicleTypeSlug}
                      className={i === 0 ? "text-2xl font-extrabold text-brand-600" : "text-xs text-gray-500"}
                    >
                      {vt?.name ?? p.vehicleTypeSlug}{" "}
                      <span className={i === 0 ? "" : "font-medium text-gray-700"}>
                        ${p.price.toFixed(0)}
                      </span>
                    </p>
                  );
                })}
              </div>

              <Link
                href="/book"
                className={`relative mt-5 rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white transition ${
                  featured ? "bg-brand-600 hover:bg-brand-700" : "bg-gray-900 hover:bg-brand-600"
                }`}
              >
                Book This
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
