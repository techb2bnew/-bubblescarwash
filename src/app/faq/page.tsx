import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";

export const metadata = {
  title: "FAQ — Bubbles Car Wash & Cafe",
  description: "Answers to common questions about booking, pricing and visiting Bubbles Car Wash & Cafe.",
};

const faqs = [
  {
    q: "How do I book a wash or detail?",
    a: "Use the Book Now button anywhere on the site. Pick your vehicle type and package, choose an available date and time, and confirm with your name, phone and email — takes under a minute.",
  },
  {
    q: "Do I need to book ahead, or can I just walk in?",
    a: "Walk-ins are welcome when we have a free slot, but booking online guarantees your time and means no waiting around — especially on weekends.",
  },
  {
    q: "How is pricing worked out?",
    a: "Pricing depends on your package (wash tier or detailing service) and vehicle size — sedans, SUVs and larger vehicles are priced separately since they take different amounts of product and time. Exact pricing is shown on the booking page before you confirm.",
  },
  {
    q: "What if my car is heavily soiled?",
    a: "Vehicles with heavy bugs, tar, built-up dirt, pet hair or sand may incur a small condition surcharge — our team will let you know before starting if extra work is needed.",
  },
  {
    q: "Can I reschedule or cancel a booking?",
    a: "Yes — call us on (08) 8369 0633 or (08) 7080 5959 and we'll move your booking to another available slot. Please give us as much notice as you can so we can offer the slot to someone else.",
  },
  {
    q: "How long does a wash or detail take?",
    a: "A quick outside wash is usually done in 25–45 minutes. Full detailing packages (interior detail, cut & polish, full detail) can take 1–4 hours depending on the condition of the vehicle.",
  },
  {
    q: "Do you offer any loyalty deals?",
    a: "Yes — buy 4 washes and get the 5th free. Ask our team in-store to start your loyalty card on your next visit.",
  },
  {
    q: "Is there somewhere to wait?",
    a: "Absolutely — that's half the point. Grab a coffee and a bite at our cafe while your car is taken care of.",
  },
  {
    q: "What are your opening hours?",
    a: "We're open 7 days: Monday to Saturday 8:00 AM – 5:00 PM, and Sunday 9:00 AM – 5:00 PM.",
  },
];

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section className="relative isolate overflow-hidden">
        <div className="relative h-64 w-full sm:h-80">
          <Image
            src="/real-photos/detail-collage.jpg"
            alt="Headlight restoration and dashboard detailing"
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/80 to-[#0b1220]/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">FAQ</p>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              Questions, <span className="wave-word wave-word-dark">answered</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-gray-300">
              Can&apos;t find what you&apos;re after? Give us a call on{" "}
              <a href="tel:0870805959" className="font-semibold text-brand-300">
                (08) 7080 5959
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-8">
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
            {faqs.map((f) => (
              <details key={f.q} className="group p-5 open:bg-gray-50">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-gray-900 marker:content-none">
                  {f.q}
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-600 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#0b1220" }} className="py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-8">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            Still have a <span className="wave-word wave-word-dark">question?</span>
          </h2>
          <p className="mt-3 text-sm text-gray-400">We&apos;re happy to help — reach out any time.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-full bg-brand-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
            >
              Contact Us
            </Link>
            <Link
              href="/book"
              className="rounded-full px-7 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/10"
            >
              Book a Wash
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
