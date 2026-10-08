"use client";

import { useEffect } from "react";
import { clearBookingDraft } from "../book/booking-draft";

/**
 * Any "Book Now" link (a plain link to /book) starts a fresh booking: the
 * saved draft is dropped and the page is loaded from scratch, wherever the
 * customer clicked it — including on /book itself, where the link would
 * otherwise do nothing. Runs in the capture phase so Next's client-side
 * navigation never gets the click. The Stripe "payment cancelled" page is
 * left alone, since its "Book again" is meant to bring the draft back.
 */
export default function BookNowRefresh() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href="/book"]');
      if (!link || (link as HTMLAnchorElement).target === "_blank") return;
      if (window.location.pathname === "/book/cancelled") return;

      e.preventDefault();
      clearBookingDraft();
      if (window.location.pathname === "/book") {
        window.location.reload();
      } else {
        // A full page load on purpose — the form must start from scratch.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/book";
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
