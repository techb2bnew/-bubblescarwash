"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SimpleEntity {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
}

export interface SimpleEntityInput {
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
}

export function EntityForm({
  entity,
  entityLabel,
  slugPlaceholder,
  onCreate,
  onUpdate,
  onDone,
}: {
  entity?: SimpleEntity;
  entityLabel: string;
  slugPlaceholder: string;
  onCreate: (input: SimpleEntityInput) => Promise<void>;
  onUpdate: (id: string, input: SimpleEntityInput) => Promise<void>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SimpleEntityInput>({
    name: entity?.name ?? "",
    slug: entity?.slug ?? "",
    sort_order: entity?.sort_order ?? 0,
    active: entity?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (entity) {
        await onUpdate(entity.id, form);
      } else {
        await onCreate(form);
      }
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Display name
        </label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={`e.g. ${slugPlaceholder}`}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Slug (used internally, no spaces)
        </label>
        <input
          required
          value={form.slug}
          onChange={(e) =>
            setForm({ ...form, slug: e.target.value.toLowerCase().trim() })
          }
          placeholder={slugPlaceholder.toLowerCase()}
          pattern="[a-z0-9\-]+"
          title="Lowercase letters, numbers, and hyphens only"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Sort order
        </label>
        <input
          type="number"
          value={form.sort_order}
          onChange={(e) =>
            setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })
          }
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
          className="h-4 w-4 accent-brand-600"
        />
        Active
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : entity ? `Update ${entityLabel}` : `Add ${entityLabel}`}
      </button>
    </form>
  );
}
