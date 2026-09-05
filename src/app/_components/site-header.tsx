"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteNavLinks } from "./site-nav-links";

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header>
      {/* Slim utility bar — hours, address, socials (scrolls away, not sticky) */}
      <div style={{ backgroundColor: "#0b1220" }} className="hidden text-gray-400 sm:block">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 text-sm sm:px-8">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" className="h-[1.125rem] w-[1.125rem] text-brand-400">
                <path
                  d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              273 North East Rd, Hampstead Gardens SA 5086
            </span>
            <span className="hidden items-center gap-2 lg:flex">
              <svg viewBox="0 0 24 24" fill="none" className="h-[1.125rem] w-[1.125rem] text-brand-400">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Open 7 days · Mon–Sat 8–5, Sun 9–5
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a href="mailto:info@bubblescarwashcafe.com.au" className="hover:text-brand-300">
              info@bubblescarwashcafe.com.au
            </a>
            <span className="h-4 w-px bg-white/15" />
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:text-brand-300">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-[1.125rem] w-[1.125rem]">
                <path d="M14 8.5h2.5V5.5H14c-2.2 0-4 1.8-4 4V12H8v3h2v6h3v-6h2.5l.5-3H13v-2c0-.8.7-1.5 1-1.5Z" />
              </svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-brand-300">
              <svg viewBox="0 0 24 24" fill="none" className="h-[1.125rem] w-[1.125rem]">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="17" cy="7" r="1" fill="currentColor" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2 sm:px-8">
          <Link href="/" onClick={() => setMenuOpen(false)} className="flex-none">
            <Image
              src="/Bubbles-Logo.png"
              alt="Bubbles Car Wash & Cafe"
              width={641}
              height={428}
              priority
              className="h-20 w-auto sm:h-24"
            />
          </Link>
          <nav className="hidden items-center gap-9 text-base font-bold text-gray-700 md:flex">
            {siteNavLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group relative flex items-center py-1 transition hover:text-brand-600 ${
                    active ? "text-brand-600" : ""
                  }`}
                >
                  {link.label === "Book" ? "Book Now" : link.label}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-0.5 rounded-full bg-brand-600 transition-all duration-200 ${
                      active ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="tel:0870805959"
              className="hidden items-center gap-2 text-base font-semibold text-gray-700 hover:text-brand-600 lg:flex"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path
                    d="M4 5c0 8.8 6.2 15 15 15l1-4-5-2-2 2c-2-1-4-3-5-5l2-2-2-5-4 1Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              (08) 7080 5959
            </a>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50 md:hidden"
            >
              {menuOpen ? (
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-gray-100 bg-white px-4 py-3 text-base font-bold text-gray-700 md:hidden">
            {siteNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2.5 transition hover:bg-brand-50 hover:text-brand-600 ${
                  isActive(link.href) ? "bg-brand-50 text-brand-600" : ""
                }`}
              >
                {link.label === "Book" ? "Book Now" : link.label}
              </Link>
            ))}
            <a
              href="tel:0870805959"
              className="rounded-lg px-3 py-2.5 transition hover:bg-brand-50 hover:text-brand-600"
            >
              (08) 7080 5959
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
