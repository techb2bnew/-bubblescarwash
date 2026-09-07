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
  headingLine1: string;
  headingLine2: string;
  body: string;
};

const slides: Slide[] = [
  {
    src: "/real-photos/hero-carwash.jpg",
    alt: "High-pressure rinse spraying down a car windscreen",
    eyebrow: "Adelaide's North East · Since 2011",
    headingLine1: "Giving your car",
    headingLine2: "the best cleaning.",
    body: "Book online in under a minute, then relax while our team takes care of the rest.",
  },
  {
    src: "/real-photos/cafe-coffee.jpg",
    alt: "Barista pouring latte art into a coffee cup",
    eyebrow: "Grab a Seat While You Wait",
    headingLine1: "A place for coffee and",
    headingLine2: "a great car wash.",
    body: "Order a fresh brew from our cafe counter while our team gets to work on your car.",
  },
  {
    src: "/real-photos/gift-voucher.jpg",
    alt: "Wrapped gift box tied with a ribbon",
    eyebrow: "Something For Someone Special",
    headingLine1: "A great gift for",
    headingLine2: "someone special.",
    body: "A Bubbles gift voucher covers a wash, a detail, or a coffee at the cafe.",
  },
];

const SLIDE_DURATION = 6000;
const TYPE_SPEED = 55;

export default function HeroSlider() {
  const [active, setActive] = useState(0);
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const full = slides[active].headingLine2;
    setTypedText("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTypedText(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, TYPE_SPEED);
    return () => clearInterval(id);
  }, [active]);

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

      <div className="relative mx-auto flex max-w-[1600px] flex-col items-center px-6 pb-14 pt-20 text-center sm:px-10 sm:pb-16 sm:pt-28 lg:px-12 lg:pb-20 lg:pt-32">
        <div className="relative min-h-[230px] w-full max-w-4xl sm:min-h-[280px] lg:min-h-[300px]">
          {slides.map((slide, i) => (
            <div
              key={slide.src}
              aria-hidden={i !== active}
              className={`absolute inset-0 flex flex-col items-center transition-opacity duration-700 ease-in-out ${
                i === active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
                {slide.eyebrow}
              </span>
              <h1 className="mt-7 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
                {slide.headingLine1}
                <br />
                <span className="text-gradient">
                  {i === active ? typedText : slide.headingLine2}
                  {i === active && typedText.length < slide.headingLine2.length && (
                    <span className="animate-pulse text-brand-400">|</span>
                  )}
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-xl text-gray-300">{slide.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-0 flex flex-wrap items-center justify-center gap-4 sm:mt-10">
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
        <div className="mt-11 flex items-center justify-center gap-3 text-white/80">
          <StarRow />
          <span className="text-base text-gray-300">Rated by real customers on Google</span>
        </div>

        {/* Slide dots */}
        <div className="mb-2 mt-10 flex items-center justify-center gap-2">
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
