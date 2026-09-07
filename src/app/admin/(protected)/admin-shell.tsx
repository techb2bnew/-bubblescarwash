"use client";

import { useState } from "react";
import Image from "next/image";
import Sidebar from "./sidebar";
import { ToastProvider } from "./_components/toast";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
    <div className="flex h-screen bg-gray-50">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Image
            src="/Bubbles-Logo.png"
            alt="Bubbles Car Wash & Cafe"
            width={641}
            height={428}
            className="h-8 w-auto"
          />
          <span className="text-sm font-semibold text-gray-900">Admin</span>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="mx-auto">{children}</div>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
