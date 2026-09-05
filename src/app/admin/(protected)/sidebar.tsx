"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./logout-button";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <path d="M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    ),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    icon: (
      <path d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 7h8M8 13h8M8 16h5" />
    ),
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: (
      <path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 0a4 4 0 0 0 3-6.65M20 20v-1a4 4 0 0 0-3-3.85" />
    ),
  },
  {
    href: "/admin/services",
    label: "Services",
    icon: (
      <path d="M9 4h6l5 5.5a2 2 0 0 1 0 2.8L14.3 18a2 2 0 0 1-2.8 0L5 11.5V6a2 2 0 0 1 2-2Zm.5 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    ),
  },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: (
      <path d="M4 6h16M4 12h16M4 18h7" />
    ),
  },
  {
    href: "/admin/vehicle-types",
    label: "Vehicle Types",
    icon: (
      <path d="M3 13.5 5 8a2 2 0 0 1 2-1.5h10A2 2 0 0 1 19 8l2 5.5M3 13.5V18a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-4.5M3 13.5h18M7 16.5h.01M17 16.5h.01" />
    ),
  },
  {
    href: "/admin/add-ons",
    label: "Add-Ons",
    icon: <path d="m5 13 4 4L19 7" />,
  },
  {
    href: "/admin/extras",
    label: "Extras",
    icon: (
      <path d="M20.6 12.9 12.9 20.6a2 2 0 0 1-2.8 0l-6.7-6.7a2 2 0 0 1 0-2.8L11.1 3.4A2 2 0 0 1 12.5 3H19a2 2 0 0 1 2 2v6.5a2 2 0 0 1-.6 1.4ZM8.5 8.5h.01" />
    ),
  },
  {
    href: "/admin/calendar",
    label: "Calendar",
    icon: (
      <path d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
    ),
  },
  {
    href: "/admin/gift-cards",
    label: "Gift Cards",
    icon: (
      <path d="M20 7H4a1 1 0 0 0-1 1v3h18V8a1 1 0 0 0-1-1ZM3 13v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5M12 7v13M7.5 7C6 7 5 5.9 5 4.5S6 2 7.5 2 10 4 12 7c2-3 3.5-5 4.5-5S19 3.1 19 4.5 18 7 16.5 7" />
    ),
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: (
      <path d="M2 10h20M6 15h4M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
    ),
  },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`admin-sidebar fixed inset-y-0 z-40 flex h-screen w-60 flex-none flex-col border-r border-black/10 bg-black md:relative ${
          open ? "admin-sidebar-open" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <Image
              src="/Bubbles-Logo.png"
              alt="Bubbles Car Wash & Cafe"
              width={641}
              height={428}
              priority
              className="h-11 w-auto"
            />
            <span className="text-xs font-medium text-white/50">Admin</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-white/60 hover:text-white md:hidden"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6 18 18M6 18 18 6" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 shrink-0"
                >
                  {item.icon}
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
