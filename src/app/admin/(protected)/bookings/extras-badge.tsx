"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BookingExtra } from "@/lib/types";

export default function ExtrasBadge({ extras }: { extras: BookingExtra[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  if (extras.length === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const total = extras.reduce((sum, e) => sum + e.price, 0);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100"
      >
        {extras.length} add-on{extras.length === 1 ? "" : "s"} · ${total.toFixed(2)}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 w-56 overflow-hidden rounded-md border border-gray-200 bg-white py-2 shadow-lg"
          >
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Purchased Add-Ons
            </div>
            <ul className="max-h-48 overflow-y-auto">
              {extras.map((extra) => (
                <li
                  key={extra.id}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-gray-700"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    {extra.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ${extra.price.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
