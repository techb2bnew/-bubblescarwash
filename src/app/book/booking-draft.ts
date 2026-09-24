/**
 * Autosaves the in-progress public booking form to sessionStorage, so a
 * customer who reaches Stripe Checkout and comes back (browser Back, or
 * Stripe's own cancel link → /book/cancelled → "Book again") finds
 * everything they typed still there instead of a blank form.
 *
 * sessionStorage rather than localStorage: scoped to this tab, gone once
 * the tab closes — appropriate for a draft nobody but this browser should
 * see, and it never leaks into a shared/public computer's next session.
 * Card entry fields are deliberately never included here, even though the
 * "pay in person" card form doesn't actually charge anything.
 */

const DRAFT_KEY = "bcw:book-draft";

/** Ignore/replace a draft this old — stale enough that "restore it" would surprise more than help. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface BookingDraft {
  step: number;
  vehicle: string;
  category: string;
  serviceId: string | null;
  extraIds: string[];
  date: string | null;
  time: string | null;
  name: string;
  phone: string;
  email: string;
  carNumber: string;
  paymentMethod: string;
  giftCard: { code: string; value: number } | null;
  discount: {
    code: string;
    discountType: "percent" | "fixed";
    value: number;
    name: string;
  } | null;
  savedAt: number;
}

export function loadBookingDraft(): BookingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as BookingDraft;
    if (!draft.savedAt || Date.now() - draft.savedAt > MAX_AGE_MS) return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveBookingDraft(draft: Omit<BookingDraft, "savedAt">): void {
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

/** Called once a booking is actually confirmed (paid, or pay-in-person accepted) — nothing left to restore. */
export function clearBookingDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Whether the "Booked with us before?" popup has already been shown on this
 * browser — localStorage rather than sessionStorage, since client feedback
 * was that it should only ever ask once per visitor, not once per tab.
 */
const RETURNING_POPUP_SEEN_KEY = "bcw:returning-popup-seen";

export function hasSeenReturningPopup(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(RETURNING_POPUP_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markReturningPopupSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RETURNING_POPUP_SEEN_KEY, "1");
  } catch {
    // ignore
  }
}
