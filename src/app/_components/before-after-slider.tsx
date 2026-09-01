"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

// A draggable before/after comparison — same photo rendered twice, with the
// "before" copy desaturated/darkened via CSS filter and clipped to a % width
// that follows the pointer. Avoids depending on two different stock photos
// (which are easy to mismatch) while still reading as a wash transformation.
export default function BeforeAfterSlider({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  return (
    <div
      ref={containerRef}
      className="group relative min-h-[320px] w-full flex-1 touch-none overflow-hidden rounded-3xl bg-gray-200 select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) updateFromClientX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      {/* After (clean) — full image underneath */}
      <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 100vw, 512px" className="object-cover" />
      <span className="absolute bottom-4 right-4 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
        After
      </span>

      {/* Before (dirty look) — same image, desaturated + darkened, clipped to pos% */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 512px"
          className="object-cover"
          style={{ filter: "grayscale(0.85) brightness(0.6) sepia(0.25)" }}
        />
        <span className="absolute bottom-4 left-4 rounded-full bg-gray-950/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
          Before
        </span>
      </div>

      {/* Drag handle */}
      <div
        className="absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-600 shadow-lg ring-1 ring-black/5">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M8 7 4 12l4 5M16 7l4 5-4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
