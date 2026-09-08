import type { AddOn, Service } from "@/lib/types";

/** Shape of a `services` row fetched with `select("*, prices:service_prices(*), inclusions(*)")`. */
export interface ServiceTemplateRow {
  id: string;
  name: string;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  prices: { id: string; vehicle_type: string; price: number }[] | null;
  inclusions: AddOn[] | null;
}

/**
 * Flattens service templates (one entity, priced per vehicle type) into the
 * one-row-per-vehicle-type `Service[]` shape every booking flow/table
 * already expects — keeps those consumers unchanged after the schema move.
 */
export function flattenServiceTemplates(templates: ServiceTemplateRow[]): Service[] {
  const result: Service[] = [];
  for (const t of templates) {
    for (const sp of t.prices ?? []) {
      result.push({
        id: t.id,
        name: t.name,
        vehicle_type: sp.vehicle_type,
        price: sp.price,
        duration_minutes: t.duration_minutes,
        active: t.active,
        created_at: t.created_at,
        inclusions: t.inclusions ?? undefined,
      });
    }
  }
  return result;
}
