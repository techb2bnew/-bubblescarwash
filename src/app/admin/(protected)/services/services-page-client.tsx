"use client";

import { useState } from "react";
import type { AddOn, CategoryRow, Service, VehicleTypeRow } from "@/lib/types";
import ServicesTable from "./services-table";
import ServiceForm from "./service-form";

export default function ServicesPageClient({
  services,
  inclusions,
  vehicleTypes,
  categories,
}: {
  services: Service[];
  inclusions: AddOn[];
  vehicleTypes: VehicleTypeRow[];
  categories: CategoryRow[];
}) {
  const [modal, setModal] = useState<"new" | Service | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Services</h1>
          <p className="mt-1 text-sm text-gray-500">
            Prices are per vehicle type and service category.
          </p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Service
        </button>
      </div>

      <ServicesTable
        services={services}
        vehicleTypes={vehicleTypes}
        categories={categories}
        onEdit={(s) => setModal(s)}
      />

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
                {modal === "new" ? "Add a service" : "Edit service"}
              </h2>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="text-xl leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <ServiceForm
              service={modal === "new" ? undefined : modal}
              inclusions={inclusions}
              vehicleTypes={vehicleTypes}
              categories={categories}
              onDone={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
