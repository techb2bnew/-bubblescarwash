const WORDS = [
  "Hand Washed",
  "Eco-Friendly",
  "Family Run Since 2011",
  "5-Star Rated",
  "Same-Day Slots",
  "Spotless Finish",
  "Cafe On Site",
  "Affordable Pricing",
];

export default function MarqueeBand() {
  const items = [...WORDS, ...WORDS];

  return (
    <div className="relative overflow-hidden bg-white py-6" aria-hidden="true">
      <div className="-rotate-2 bg-gradient-to-r from-brand-500 to-brand-600 py-3.5 shadow-lg shadow-brand-600/20">
        <div className="marquee-track flex w-max items-center gap-3 whitespace-nowrap">
          {items.map((word, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="text-sm font-extrabold uppercase tracking-widest text-gray-950">
                {word}
              </span>
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-gray-950/70" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
