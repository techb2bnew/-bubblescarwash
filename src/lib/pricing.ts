import type { AddOn, Service } from "@/lib/types";

/** Same formula the old `services.effective_price` generated column used. */
export function computeEffectivePrice(
  price: number,
  discountPercent: number,
  discountActive: boolean,
): number {
  const percentOff = discountActive ? discountPercent : 0;
  return Math.round(price * (1 - percentOff / 100) * 100) / 100;
}

/** Shape of a `services` row fetched with `select("*, prices:service_prices(*), inclusions(*)")`. */
export interface ServiceTemplateRow {
  id: string;
  name: string;
  discount_percent: number;
  discount_active: boolean;
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
        discount_percent: t.discount_percent,
        discount_active: t.discount_active,
        effective_price: computeEffectivePrice(sp.price, t.discount_percent, t.discount_active),
        duration_minutes: t.duration_minutes,
        active: t.active,
        created_at: t.created_at,
        inclusions: t.inclusions ?? undefined,
      });
    }
  }
  return result;
}
