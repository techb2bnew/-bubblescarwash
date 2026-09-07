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

function Strip({
  reverse = false,
  dark = false,
}: {
  reverse?: boolean;
  dark?: boolean;
}) {
  const items = [...WORDS, ...WORDS];

  return (
    <div
      className={`${reverse ? "rotate-2" : "-rotate-2"} py-3.5 shadow-lg ${
        dark
          ? "bg-gray-950 shadow-black/30"
          : "bg-gradient-to-r from-brand-500 to-brand-600 shadow-brand-600/20"
      }`}
    >
      <div
        className={`${
          reverse ? "marquee-track-reverse" : "marquee-track"
        } flex w-max items-center gap-3 whitespace-nowrap`}
      >
        {items.map((word, i) => (
          <span key={i} className="flex items-center gap-3">
            <span
              className={`text-sm font-extrabold uppercase tracking-widest ${
                dark ? "text-brand-400" : "text-gray-950"
              }`}
            >
              {word}
            </span>
            <span
              className={`h-1.5 w-1.5 flex-none rounded-full ${
                dark ? "bg-brand-400/70" : "bg-gray-950/70"
              }`}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MarqueeBand() {
  return (
    <div className="relative overflow-hidden bg-white py-16" aria-hidden="true">
      <div className="relative">
        <div className="relative z-10">
          <Strip dark />
        </div>
        <div className="absolute inset-x-0 top-0 z-20 -mt-2">
          <Strip reverse />
        </div>
      </div>
    </div>
  );
}
