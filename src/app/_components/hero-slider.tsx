"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

function StarRow() {
  return (
    <div className="flex gap-0.5 text-brand-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7L10 1.5Z" />
        </svg>
      ))}
    </div>
  );
}

type Slide = {
  src: string;
  alt: string;
  eyebrow: string;
  heading: React.ReactNode;
  body: string;
};

const slides: Slide[] = [
  {
    src: "/real-photos/hero-carwash.jpg",
    alt: "High-pressure rinse spraying down a car windscreen",
    eyebrow: "Adelaide's North East · Since 2011",
    heading: (
      <>
        Giving your car
        <br />
        <span className="text-gradient">the best cleaning.</span>
      </>
    ),
    body: "A place for coffee and a great car wash — book online in under a minute, then relax while our team takes care of the rest.",
  },
  {
    src: "/real-photos/cafe-coffee.jpg",
    alt: "Barista pouring latte art into a coffee cup",
    eyebrow: "Grab a Seat While You Wait",
    heading: (
      <>
        A place for coffee
        <br />
        <span className="text-gradient">and a great car wash.</span>
      </>
    ),
    body: "Order a fresh brew from our cafe counter while our team gets to work — coffee, cake and a clean car, all in one stop.",
  },
  {
    src: "/real-photos/gift-voucher.jpg",
    alt: "Wrapped gift box tied with a ribbon",
    eyebrow: "Something For Someone Special",
    heading: (
      <>
        A great gift for
        <br />
        <span className="text-gradient">someone special.</span>
      </>
    ),
    body: "Can't decide what to get them? A Bubbles gift voucher covers a wash, a detail, or a coffee — ask our team in-store.",
  },
];

const SLIDE_DURATION = 6000;

export default function HeroSlider() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/85 to-[#0b1220]/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1220]/70 via-transparent to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-14 pt-28 sm:px-10 sm:pb-16 sm:pt-36 lg:px-12 lg:pb-20 lg:pt-44">
        <div className="min-h-[340px] max-w-2xl sm:min-h-[300px]">
          {slides.map((slide, i) => (
            <div
              key={slide.src}
              className={`transition-all duration-700 ${
                i === active
                  ? "relative opacity-100"
                  : "pointer-events-none absolute inset-0 opacity-0"
              }`}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
                {slide.eyebrow}
              </span>
              <h1 className="mt-7 text-5xl font-extrabold leading-tight text-white sm:text-6xl lg:text-7xl">
                {slide.heading}
              </h1>
              <p className="mt-7 max-w-xl text-xl text-gray-300">{slide.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/book"
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-9 py-5 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/40"
          >
            Book a Wash
          </Link>
          <Link
            href="/services"
            className="rounded-full px-9 py-5 text-lg font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/10"
          >
            See Packages
          </Link>
        </div>
        <div className="mt-11 flex items-center gap-3 text-white/80">
          <StarRow />
          <span className="text-base text-gray-300">Rated by real customers on Google</span>
        </div>

        {/* Slide dots */}
        <div className="mt-10 flex items-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              aria-label={`Show slide ${i + 1}: ${slide.eyebrow}`}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${
                i === active ? "w-8 bg-brand-500" : "w-2 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
