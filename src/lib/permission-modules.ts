import type { ModuleKey } from "@/lib/types";

/** No I/O here — safe to import from both Server Components/actions and the edge proxy. */
export interface ModuleDef {
  key: ModuleKey;
  label: string;
  href: string;
  /** Actions beyond "view" meaningful for this module — decides which checkboxes the permissions page shows. */
  actions: ("create" | "edit" | "delete")[];
}

export const MODULES: ModuleDef[] = [
  { key: "analytics", label: "Analytics", href: "/admin/analytics", actions: [] },
  { key: "bookings", label: "Bookings", href: "/admin/bookings", actions: ["edit"] },
  { key: "calendar", label: "Calendar", href: "/admin/calendar", actions: ["create"] },
  { key: "set_operations", label: "Set Operations", href: "/admin/calendar/set-operations", actions: ["edit"] },
  { key: "customers", label: "Customers", href: "/admin/customers", actions: ["create", "edit", "delete"] },
  { key: "services", label: "Services", href: "/admin/services", actions: ["create", "edit", "delete"] },
  { key: "inclusions", label: "Inclusions", href: "/admin/add-ons", actions: ["create", "edit", "delete"] },
  { key: "categories", label: "Categories", href: "/admin/categories", actions: ["create", "edit", "delete"] },
  { key: "vehicle_types", label: "Vehicle Types", href: "/admin/vehicle-types", actions: ["create", "edit", "delete"] },
  { key: "extras", label: "Add-Ons", href: "/admin/extras", actions: ["create", "edit", "delete"] },
  { key: "gift_cards", label: "Gift Cards", href: "/admin/gift-cards", actions: ["create", "edit", "delete"] },
  { key: "discounts", label: "Discounts", href: "/admin/discounts", actions: ["create", "edit", "delete"] },
  { key: "payments", label: "Payments", href: "/admin/payments", actions: [] },
];

/**
 * Which module governs a given /admin/* pathname, or null for the dashboard
 * (always visible — not gated) and unrecognized/admin-only paths like
 * /admin/staff (never shown to staff, regardless of any permission row).
 */
export function moduleForPathname(pathname: string): ModuleKey | null {
  if (pathname === "/admin/calendar/set-operations" || pathname.startsWith("/admin/calendar/set-operations/")) {
    return "set_operations";
  }
  if (pathname === "/admin/bookings" || pathname.startsWith("/admin/bookings/")) return "bookings";
  if (pathname === "/admin/calendar" || pathname.startsWith("/admin/calendar/")) return "calendar";
  if (pathname === "/admin/analytics") return "analytics";
  if (pathname === "/admin/customers" || pathname.startsWith("/admin/customers/")) return "customers";
  if (pathname === "/admin/services" || pathname.startsWith("/admin/services/")) return "services";
  if (pathname === "/admin/add-ons" || pathname.startsWith("/admin/add-ons/")) return "inclusions";
  if (pathname === "/admin/categories" || pathname.startsWith("/admin/categories/")) return "categories";
  if (pathname === "/admin/vehicle-types" || pathname.startsWith("/admin/vehicle-types/")) return "vehicle_types";
  if (pathname === "/admin/extras" || pathname.startsWith("/admin/extras/")) return "extras";
  if (pathname === "/admin/gift-cards" || pathname.startsWith("/admin/gift-cards/")) return "gift_cards";
  if (pathname === "/admin/discounts" || pathname.startsWith("/admin/discounts/")) return "discounts";
  if (pathname === "/admin/payments" || pathname.startsWith("/admin/payments/")) return "payments";
  return null;
}
