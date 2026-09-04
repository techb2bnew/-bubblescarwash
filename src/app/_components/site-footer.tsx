import Image from "next/image";
import Link from "next/link";
import { siteNavLinks } from "./site-nav-links";

const socials = [
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M14 8.5h2.5V5.5H14c-2.2 0-4 1.8-4 4V12H8v3h2v6h3v-6h2.5l.5-3H13v-2c0-.8.7-1.5 1-1.5Z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17" cy="7" r="1" fill="currentColor" />
      </svg>
    ),
  },
];

const contactRows = [
  {
    label: "273 North East Rd, Hampstead Gardens SA 5086",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: "(08) 8369 0633",
    href: "tel:0883690633",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M4 5c0 8.8 6.2 15 15 15l1-4-5-2-2 2c-2-1-4-3-5-5l2-2-2-5-4 1Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "info@bubblescarwashcafe.com.au",
    href: "mailto:info@bubblescarwashcafe.com.au",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function SiteFooter() {
  return (
    <footer style={{ backgroundColor: "#0b1220" }} className="relative overflow-hidden text-gray-300">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />

      {/* Newsletter strip */}
      <div className="relative border-b border-white/10">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-600/20 text-brand-400">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-white">
              Subscribe for wash-day tips &amp; loyalty offers
            </p>
          </div>
          <form className="flex w-full max-w-sm gap-2 sm:w-auto">
            <input
              type="email"
              placeholder="Your email"
              className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              className="flex-none rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-[1600px] grid-cols-1 gap-10 px-4 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr]">
        <div>
          <Image
            src="/Bubbles-Logo.png"
            alt="Bubbles Car Wash & Cafe"
            width={641}
            height={428}
            className="h-14 w-auto"
          />
          <p className="mt-4 max-w-xs text-sm text-gray-400">
            Adelaide&apos;s north east wash &amp; cafe since 2011 — a clean car and a good coffee,
            every time.
          </p>
          <div className="mt-5 flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-gray-300 transition hover:bg-brand-600 hover:text-white"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-white">Quick Links</p>
          <ul className="mt-4 space-y-2 text-sm">
            {siteNavLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-brand-400">
                  {link.label === "Book" ? "Book Now" : link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-white">Opening Hours</p>
          <div className="mt-4 space-y-2 text-sm">
            <p className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <span className="font-semibold text-brand-400">Mon–Sat</span>
              <span>8:00 AM – 5:00 PM</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="font-semibold text-brand-400">Sunday</span>
              <span>9:00 AM – 5:00 PM</span>
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-white">Get In Touch</p>
          <ul className="mt-4 space-y-3 text-sm">
            {contactRows.map((row) => (
              <li key={row.label} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/10 text-brand-400">
                  {row.icon}
                </span>
                {row.href ? (
                  <a href={row.href} className="transition hover:text-brand-400">
                    {row.label}
                  </a>
                ) : (
                  <span>{row.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative border-t border-white/10 py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} Bubbles Car Wash &amp; Cafe. All rights reserved.
      </div>
    </footer>
  );
}
