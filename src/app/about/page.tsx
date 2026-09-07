import Image from "next/image";
import MarqueeBand from "../_components/marquee-band";
import Link from "next/link";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";
import StatsBand from "../_components/stats-band";

export const metadata = {
  title: "About Us — Bubbles Car Wash & Cafe",
  description:
    "Bubbles Car Wash & Cafe has been washing, detailing and caffeinating Adelaide's north east since 2011.",
};

const timeline = [
  {
    year: "2011",
    title: "Bubbles opens its doors",
    body: "A small hand-wash bay and a coffee machine on North East Rd — the idea was simple: make car care something you actually look forward to.",
  },
  {
    year: "2015",
    title: "Detailing added",
    body: "As regulars started asking for more, we brought in clay bar treatments, cut & polish, and full interior detailing alongside the wash menu.",
  },
  {
    year: "2020",
    title: "The cafe grows up",
    body: "What started as a coffee machine in the corner became a proper cafe — fresh brews and snacks while you wait, every day of the week.",
  },
  {
    year: "Today",
    title: "Online booking",
    body: "You can now book a wash or detail online in under a minute, with live availability and reminders — no more guessing wait times.",
  },
];

const values = [
  {
    title: "Care, not just cleaning",
    body: "Every vehicle gets checked over before it leaves — swirl marks, missed spots and heavy soiling get flagged, not ignored.",
  },
  {
    title: "Honest pricing",
    body: "What you see on the booking page is what you pay. No surprise add-ons sprung on you at pickup.",
  },
  {
    title: "Environmentally mindful",
    body: "We use pH-neutral shampoos and reclaim water where we can — a clean car shouldn't cost the environment.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section style={{ backgroundColor: "#0b1220" }} className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-10 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
              Our Story
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Fifteen years of clean cars and good <span className="wave-word wave-word-dark">coffee</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-gray-400">
              Bubbles Car Wash &amp; Cafe has been part of Adelaide&apos;s north east since 2011 —
              a family-run wash bay that grew into a proper stop for your car and your coffee
              break, both.
            </p>
          </div>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl shadow-2xl shadow-black/40 ring-1 ring-white/10">
            <Image
              src="/real-photos/hero-carwash.jpg"
              alt="High-pressure rinse spraying down a car windscreen"
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      <MarqueeBand />

      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              How We Got Here
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Our <span className="wave-word">journey</span>
            </h2>
          </div>

          <ol className="mt-14 space-y-10 border-l border-gray-100 pl-8">
            {timeline.map((t) => (
              <li key={t.year} className="relative">
                <span className="absolute -left-[calc(2rem+5px)] top-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
                  {t.year}
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-900">{t.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{t.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              What We Stand For
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Our <span className="wave-word">values</span>
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {values.map((v) => (
              <div key={v.title} className="rounded-2xl border border-gray-100 bg-white p-6">
                <div className="h-1 w-10 rounded-full bg-brand-500" />
                <h3 className="mt-4 text-base font-bold text-gray-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StatsBand />

      <section style={{ backgroundColor: "#0b1220" }} className="py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-8">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            Come see us in <span className="wave-word wave-word-dark">person</span>
          </h2>
          <p className="mt-3 text-sm text-gray-400">
            273 North East Rd, Hampstead Gardens SA 5086 — open 7 days.
          </p>
          <Link
            href="/book"
            className="mt-6 inline-flex rounded-full bg-brand-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
          >
            Book a Wash
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
