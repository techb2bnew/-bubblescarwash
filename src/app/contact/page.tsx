import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";
import ContactForm from "./contact-form";

export const metadata = {
  title: "Contact — Bubbles Car Wash & Cafe",
  description: "Get in touch with Bubbles Car Wash & Cafe — phone, email, address and opening hours.",
};

const contactCards = [
  {
    title: "Call Us",
    body: "For bookings, rescheduling or a quick question, give us a call.",
    action: { label: "(08) 7080 5959", href: "tel:0870805959" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path
          d="M4 5c0 8.8 6.2 15 15 15l1-4-5-2-2 2c-2-1-4-3-5-5l2-2-2-5-4 1Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Email Us",
    body: "Prefer writing it down? Send us an email and we'll reply within a day.",
    action: { label: "info@bubblescarwashcafe.com.au", href: "mailto:info@bubblescarwashcafe.com.au" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Visit Us",
    body: "Drop by any day of the week — no appointment needed for a walk-in wash.",
    action: { label: "273 North East Rd, Hampstead Gardens SA 5086", href: "https://maps.google.com/?q=273+North+East+Rd+Hampstead+Gardens+SA+5086" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path
          d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section className="relative isolate overflow-hidden">
        <div className="relative h-64 w-full sm:h-80">
          <Image
            src="/real-photos/cafe-coffee.jpg"
            alt="Barista pouring latte art into a coffee cup"
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/80 to-[#0b1220]/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
              Get In Touch
            </span>
            <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">
              We&apos;d love to hear from <span className="wave-word wave-word-dark">you</span>
            </h1>
            <p className="mt-4 max-w-md text-sm text-gray-300">
              Questions about a booking, pricing, or just want to say hi — here&apos;s how to reach us.
            </p>
          </div>
        </div>
      </section>


      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {contactCards.map((c) => (
              <div
                key={c.title}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  {c.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-gray-900">{c.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{c.body}</p>
                  <a
                    href={c.action.href}
                    target={c.action.href.startsWith("http") ? "_blank" : undefined}
                    rel={c.action.href.startsWith("http") ? "noreferrer" : undefined}
                    className="mt-2 block truncate text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {c.action.label}
                  </a>
                </div>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-50 text-gray-400 transition group-hover:text-brand-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Send Us A Message
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-gray-900">
                Get In <span className="wave-word">Touch</span>
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Fill out the form below and we&apos;ll get back to you as soon as possible.
              </p>
              <div className="mt-6">
                <ContactForm />
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-50" />
                <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="relative mt-4 text-xs font-semibold uppercase tracking-widest text-brand-600">
                  Opening Hours
                </p>
                <h3 className="relative mt-1 text-xl font-extrabold text-gray-900">
                  Open 7 Days A Week
                </h3>
                <div className="relative mt-5 space-y-2 text-sm text-gray-600">
                  <p className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="font-semibold text-gray-900">Monday – Saturday</span>
                    <span>8:00 AM – 5:00 PM</span>
                  </p>
                  <p className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="font-semibold text-gray-900">Sunday</span>
                    <span>9:00 AM – 5:00 PM</span>
                  </p>
                </div>
                <Link
                  href="/book"
                  className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  Book a Wash
                </Link>
              </div>

              <div className="flex flex-col rounded-2xl bg-gray-950 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
                  Prefer To Plan Ahead?
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-white">
                  Book Your Car Wash Today
                </h3>
                <p className="mt-3 text-sm text-gray-300">
                  Booking online guarantees your slot — no waiting around when you arrive. Have a
                  question first? Check our{" "}
                  <Link href="/faq" className="font-semibold text-brand-300 hover:text-brand-200">
                    FAQ
                  </Link>{" "}
                  or give us a call.
                </p>
                <Link
                  href="/book"
                  className="mt-5 inline-flex items-center gap-2 self-start rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  Book Now
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-white">
        <div className="relative h-80 w-full sm:h-96 lg:h-[450px]">
          <iframe
            src="https://maps.google.com/maps?q=216%2F218%20North%20East%20Road%2C%20Klemzig%20SA%205087&t=m&z=16&output=embed&iwloc=near"
            title="Bubbles Car Wash & Cafe on Google Maps"
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="pointer-events-none absolute inset-0 hidden items-start p-6 sm:flex">
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white p-4 shadow-xl shadow-gray-900/10 ring-1 ring-gray-100">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">Bubbles Car Wash &amp; Cafe</p>
                <p className="text-xs text-gray-500">273 North East Rd, Hampstead Gardens SA 5086</p>
              </div>
              <a
                href="https://maps.google.com/?q=273+North+East+Rd+Hampstead+Gardens+SA+5086"
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                Get Directions
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
