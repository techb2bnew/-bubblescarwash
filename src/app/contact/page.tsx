import Link from "next/link";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";

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

      <section style={{ backgroundColor: "#0b1220" }} className="py-16 text-center text-white sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
            Get In Touch
          </span>
          <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">We&apos;d love to hear from you</h1>
          <p className="mt-4 text-sm text-gray-400">
            Questions about a booking, pricing, or just want to say hi — here&apos;s how to reach us.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:grid-cols-3 sm:px-8">
          {contactCards.map((c) => (
            <div key={c.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                {c.icon}
              </div>
              <h3 className="mt-4 text-base font-bold text-gray-900">{c.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{c.body}</p>
              <a
                href={c.action.href}
                target={c.action.href.startsWith("http") ? "_blank" : undefined}
                rel={c.action.href.startsWith("http") ? "noreferrer" : undefined}
                className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                {c.action.label}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-10 px-4 sm:grid-cols-2 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              Opening Hours
            </p>
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900">Open 7 days a week</h2>
            <div className="mt-6 space-y-2 text-sm text-gray-600">
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
              className="mt-8 inline-flex rounded-full bg-brand-600 px-7 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
            >
              Book a Wash
            </Link>
          </div>
          <div className="flex flex-col justify-center rounded-2xl bg-gray-950 p-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
              Prefer to plan ahead?
            </p>
            <p className="mt-3 text-sm text-gray-400">
              Booking online guarantees your slot — no waiting around when you arrive. Have a
              question first? Check our{" "}
              <Link href="/faq" className="font-semibold text-brand-300 hover:text-brand-200">
                FAQ
              </Link>{" "}
              or give us a call.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
