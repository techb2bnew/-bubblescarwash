/**
 * Keeps the browser Back button from dragging a customer back into a booking
 * that is already finished.
 *
 * After paying, the customer sits on /book/confirmation with the booking form
 * one step behind them in history. Back should take them to the home page, not
 * back to that stale form or the old confirmation. The confirmation page leaves
 * a flag in sessionStorage; if /book or /book/confirmation is then reached by
 * the Back/Forward buttons, the visitor is sent to the home page instead. The
 * flag is dropped as soon as /book is opened any other way (Book Now, a typed
 * URL), so starting another booking works normally.
 */

const JUST_CONFIRMED_KEY = "bcw:just-confirmed";

export function markJustConfirmed(): void {
  try {
    window.sessionStorage.setItem(JUST_CONFIRMED_KEY, "1");
  } catch {
    // storage blocked — the Back button simply behaves as the browser default
  }
}

export function hasJustConfirmed(): boolean {
  try {
    return window.sessionStorage.getItem(JUST_CONFIRMED_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearJustConfirmed(): void {
  try {
    window.sessionStorage.removeItem(JUST_CONFIRMED_KEY);
  } catch {
    // ignore
  }
}

/** True when this page load came from the browser's Back/Forward buttons. */
export function arrivedViaHistory(): boolean {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return nav?.type === "back_forward";
}
