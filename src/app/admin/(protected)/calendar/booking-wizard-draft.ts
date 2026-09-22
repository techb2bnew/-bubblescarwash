/**
 * Autosaves the admin "Create new booking" wizard to sessionStorage, so an
 * admin who reaches Stripe Checkout (the "Charge via Stripe" path) and
 * cancels — or hits browser Back — lands on a fresh /admin/calendar load
 * with the customer, vehicle, car, service, add-ons, and time they'd
 * already picked still filled in, instead of starting over at step 1.
 *
 * sessionStorage rather than localStorage: scoped to this tab, gone once
 * the tab closes — an abandoned draft nobody but this browser should see.
 */

const DRAFT_KEY = "bcw:admin-booking-draft";

/** Ignore/replace a draft this old — stale enough that "restore it" would surprise more than help. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface AdminBookingWizardDraft {
  bookingDate: string;
  step: number;
  customerMode: "existing" | "new";
  selectedCustomerId: string | null;
  name: string;
  phone: string;
  email: string;
  carNumber: string;
  carMode: "choose" | "new";
  vehicleSlug: string;
  categoryId: string;
  serviceId: string;
  extraIds: string[];
  time: string | null;
  overrideAvailability: boolean;
  savedAt: number;
}

export function loadWizardDraft(): AdminBookingWizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as AdminBookingWizardDraft;
    if (!draft.savedAt || Date.now() - draft.savedAt > MAX_AGE_MS) return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveWizardDraft(draft: Omit<AdminBookingWizardDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() }),
    );
  } catch {
    // Private-browsing/storage-blocked environments — the form just won't
    // survive a round trip to Stripe there. Not worth surfacing an error for.
  }
}

/** Called once a booking is actually created (Pay Later, or Stripe payment confirmed) — nothing left to restore. */
export function clearWizardDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
