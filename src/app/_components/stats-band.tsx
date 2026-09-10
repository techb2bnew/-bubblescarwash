const STATS = [
  { value: "15+", label: "Years in Adelaide" },
  { value: "7", label: "Days open a week" },
  { value: "3", label: "Wash tiers to choose from" },
  { value: "5★", label: "Rated by real customers" },
];

// A dark, high-contrast stat strip — the kind of "4M+ / 89+ / 2/5" band
// used to build trust quickly on a services page.
export default function StatsBand() {
  return (
    <section style={{ backgroundColor: "#0b1220" }} className="border-t border-white/10 py-14">
      <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-8 px-4 sm:grid-cols-4 sm:px-8">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-extrabold text-brand-400 sm:text-4xl">{s.value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400 sm:text-sm">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
