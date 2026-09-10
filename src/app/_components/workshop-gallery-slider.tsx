"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Photo = { src: string; alt: string };

const SLIDE_DURATION = 3000;

export default function WorkshopGallerySlider({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % photos.length);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, [photos.length]);

  const n = photos.length;
  const left = photos[(active - 1 + n) % n];
  const center = photos[active];
  const right = photos[(active + 1) % n];

  return (
    <div className="mt-10 flex items-center justify-center gap-6 sm:gap-8">
      {[left, center, right].map((p, slot) => (
        <div
          key={slot}
          className={`relative overflow-hidden rounded-3xl shadow-xl ring-4 ring-brand-50 transition-all duration-700 ease-in-out ${
            slot === 1
              ? "h-56 w-56 sm:h-72 sm:w-72"
              : "h-36 w-36 sm:h-44 sm:w-44 opacity-80"
          }`}
        >
          <Image
            key={p.src}
            src={p.src}
            alt={p.alt}
            fill
            sizes="300px"
            className="fade-in object-cover"
          />
          {slot === 1 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/40 text-center text-white opacity-0 transition hover:opacity-100">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">Detailing</p>
              <p className="mt-1 text-sm font-bold">Pristine Perspectives</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
