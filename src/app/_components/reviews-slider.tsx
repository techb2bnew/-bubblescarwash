"use client";

import { useState } from "react";

type Review = {
  name: string;
  meta: string;
  time: string;
  quote: string;
};

const avatarColors = [
  "bg-[#f9ab00]",
  "bg-[#4285f4]",
  "bg-[#34a853]",
  "bg-[#ea4335]",
  "bg-[#a142f4]",
  "bg-[#00a3bf]",
];

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h11.9c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.9 6.5-9.6 6.5-16.7z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 7 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z" />
    </svg>
  );
}

function GoogleStars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" fill="#fbbc05" className="h-3.5 w-3.5">
          <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7L10 1.5Z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSlider({ reviews }: { reviews: Review[] }) {
  const [page, setPage] = useState(0);
  const perPage = 3;
  const pageCount = Math.ceil(reviews.length / perPage);

  return (
    <div>
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {Array.from({ length: pageCount }).map((_, p) => (
            <div key={p} className="grid w-full flex-none grid-cols-1 gap-6 sm:grid-cols-3">
              {reviews.slice(p * perPage, p * perPage + perPage).map((r, i) => (
                <figure
                  key={r.name}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold text-white ${
                        avatarColors[(p * perPage + i) % avatarColors.length]
                      }`}
                    >
                      {r.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.meta}</p>
                    </div>
                    <GoogleLogo />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <GoogleStars />
                    <span className="text-xs text-gray-500">{r.time}</span>
                  </div>
                  <blockquote className="mt-3 text-sm leading-relaxed text-gray-700">{r.quote}</blockquote>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </div>

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Previous reviews"
            onClick={() => setPage((p) => (p - 1 + pageCount) % pageCount)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: pageCount }).map((_, p) => (
              <button
                key={p}
                type="button"
                aria-label={`Show reviews page ${p + 1}`}
                onClick={() => setPage(p)}
                className={`h-2 rounded-full transition-all ${
                  p === page ? "w-6 bg-brand-600" : "w-2 bg-gray-200 hover:bg-gray-300"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next reviews"
            onClick={() => setPage((p) => (p + 1) % pageCount)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
