"use client";

import { useState } from "react";
import { EntityForm, type SimpleEntity, type SimpleEntityInput } from "./entity-form";
import { EntityTable } from "./entity-table";

export function EntityPageClient({
  entities,
  title,
  description,
  entityLabel,
  entityLabelPlural,
  slugPlaceholder,
  onCreate,
  onUpdate,
  onDelete,
  onToggleActive,
}: {
  entities: SimpleEntity[];
  title: string;
  description: string;
  entityLabel: string;
  entityLabelPlural: string;
  slugPlaceholder: string;
  onCreate: (input: SimpleEntityInput) => Promise<void>;
  onUpdate: (id: string, input: SimpleEntityInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (id: string, active: boolean) => Promise<void>;
}) {
  const [modal, setModal] = useState<"new" | SimpleEntity | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add {entityLabel}
        </button>
      </div>

      <EntityTable
        entities={entities}
        entityLabel={entityLabel}
        entityLabelPlural={entityLabelPlural}
        onEdit={(e) => setModal(e)}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
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
                {modal === "new" ? `Add ${entityLabel.toLowerCase()}` : `Edit ${entityLabel.toLowerCase()}`}
              </h2>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                className="text-xl leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <EntityForm
              entity={modal === "new" ? undefined : modal}
              entityLabel={entityLabel}
              slugPlaceholder={slugPlaceholder}
              onCreate={onCreate}
              onUpdate={onUpdate}
              onDone={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
