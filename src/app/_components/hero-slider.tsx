import Image from "next/image";
import Link from "next/link";

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

// Client feedback: the rotating/typewriter hero copy wasn't wanted — one
// static heading and a single clear Book Now button instead.
export default function HeroSlider() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/real-photos/foam-red-car.png"
          alt="High-pressure rinse spraying down a car windscreen"
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/85 to-[#0b1220]/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1220]/70 via-transparent to-transparent" />
      </div>

      <div className="relative mx-auto flex max-w-[1600px] flex-col items-center px-6 pb-14 pt-20 text-center sm:px-10 sm:pb-16 sm:pt-28 lg:px-12 lg:pb-20 lg:pt-32">
        <div className="relative flex w-full max-w-4xl flex-col items-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
            Adelaide&apos;s North East · Since 2011
          </span>
          <h1 className="mt-7 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            Give Your Car
            <br />
            <span className="text-gradient">The Best Cleaning.</span>
          </h1>
          <p className="mt-7 max-w-xl text-xl text-gray-300">
            Book online in under a minute, then relax while our team takes care of the rest.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/book"
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-9 py-5 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/40"
          >
            Book Now
          </Link>
          <Link
            href="/services"
            className="rounded-full px-9 py-5 text-lg font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/10"
          >
            See Packages
          </Link>
        </div>
        <a
          href="https://www.google.com/search?q=Bubbles+Car+Wash+%26+Cafe+Hampstead+Gardens+reviews"
          target="_blank"
          rel="noreferrer"
          className="mt-11 flex items-center justify-center gap-3 text-white/80 transition hover:text-white"
        >
          <StarRow />
          <span className="text-base text-gray-300 underline-offset-4 hover:underline">
            Rated by real customers on Google
          </span>
        </a>
      </div>
    </section>
  );
}
