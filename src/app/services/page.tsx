import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRow, Service, VehicleTypeRow } from "@/lib/types";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";
import StatsBand from "../_components/stats-band";

export const metadata = {
  title: "Services & Pricing — Bubbles Car Wash & Cafe",
  description: "Every wash and detailing package at Bubbles Car Wash & Cafe, with live pricing per vehicle size.",
};

type Tier = {
  name: string;
  category: string;
  duration_minutes: number;
  prices: { vehicleTypeSlug: string; price: number }[];
  features: string[];
};

async function getWashPackages() {
  const supabase = await createClient();

  const [
    { data: categories },
    { data: vehicleTypes },
    { data: services },
    { data: inclusions },
  ] = await Promise.all([
    supabase.from("service_categories").select("*").eq("active", true).order("sort_order"),
    supabase.from("vehicle_types").select("*").eq("active", true).order("sort_order"),
    supabase.from("services").select("*, service_inclusions(inclusion_id)").eq("active", true),
    supabase.from("inclusions").select("*").order("sort_order"),
  ]);

  const inclusionNameById = new Map(
    ((inclusions as { id: string; name: string }[]) ?? []).map((i) => [i.id, i.name]),
  );

  const tiersByName = new Map<string, Tier>();
  for (const s of (services as Service[]) ?? []) {
    const key = `${s.category}:${s.name}`;
    const existing = tiersByName.get(key);
    const features = (s.service_inclusions ?? [])
      .map((si) => inclusionNameById.get(si.inclusion_id))
      .filter((n): n is string => Boolean(n));

    if (existing) {
      existing.prices.push({ vehicleTypeSlug: s.vehicle_type, price: s.price });
      if (features.length > existing.features.length) existing.features = features;
    } else {
      tiersByName.set(key, {
        name: s.name,
        category: s.category,
        duration_minutes: s.duration_minutes,
        prices: [{ vehicleTypeSlug: s.vehicle_type, price: s.price }],
        features,
      });
    }
  }

  const vehicleOrder = new Map(((vehicleTypes as VehicleTypeRow[]) ?? []).map((v, i) => [v.slug, i]));
  const tiers = [...tiersByName.values()].map((t) => ({
    ...t,
    prices: t.prices.sort(
      (a, b) => (vehicleOrder.get(a.vehicleTypeSlug) ?? 0) - (vehicleOrder.get(b.vehicleTypeSlug) ?? 0),
    ),
  }));

  return {
    categories: (categories as CategoryRow[]) ?? [],
    vehicleTypes: (vehicleTypes as VehicleTypeRow[]) ?? [],
    tiers,
  };
}

const PROCESS_STEPS = [
  {
    title: "Book online",
    body: "Pick a package and a time slot that suits you — takes under a minute.",
  },
  {
    title: "Drop off",
    body: "Bring your car in at your slot. No paperwork, just hand over the keys.",
  },
  {
    title: "Relax with a coffee",
    body: "Grab a fresh coffee at the cafe while our team gets to work.",
  },
  {
    title: "Drive away clean",
    body: "Pick up your car, checked over and ready to go.",
  },
];

export default async function ServicesPage() {
  const { categories, vehicleTypes, tiers } = await getWashPackages();

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section style={{ backgroundColor: "#0b1220" }} className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-10 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
              Services &amp; Pricing
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Every wash and detail, priced live
            </h1>
            <p className="mt-5 max-w-md text-base text-gray-400">
              From a quick outside rinse to full paint correction — pick the package that suits
              your car, see the price up front, and book straight online.
            </p>
            <Link
              href="/book"
              className="mt-8 inline-flex rounded-full bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
            >
              Book Now
            </Link>
          </div>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl shadow-2xl shadow-black/40 ring-1 ring-white/10">
            <Image
              src="https://images.pexels.com/photos/5233259/pexels-photo-5233259.jpeg"
              alt="Detailer polishing a car"
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* Dynamic packages */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          {tiers.length === 0 ? (
            <p className="text-center text-sm text-gray-500">
              Packages are being updated — please check back shortly.
            </p>
          ) : (
            categories.map((cat) => {
              const catTiers = tiers.filter((t) => t.category === cat.slug);
              if (catTiers.length === 0) return null;
              return (
                <div key={cat.slug} className="mb-14">
                  <h2 className="text-lg font-bold text-gray-900">{cat.name}</h2>
                  <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {catTiers.map((tier, idx) => (
                      <div
                        key={tier.name}
                        className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                          idx === 1 ? "border-brand-300 ring-1 ring-brand-200" : "border-gray-100"
                        }`}
                      >
                        <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-50" />
                        <div className="relative">
                          <h3 className="text-base font-bold text-gray-900">{tier.name}</h3>
                          <p className="mt-1 text-xs text-gray-400">~{tier.duration_minutes} min</p>
                        </div>

                        {tier.features.length > 0 && (
                          <ul className="relative mt-4 space-y-1.5 text-sm text-gray-600">
                            {tier.features.slice(0, 6).map((f) => (
                              <li key={f} className="flex gap-2">
                                <span className="mt-0.5 text-brand-500">✓</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="relative mt-5 flex-1 space-y-1 border-t border-gray-100 pt-4">
                          {tier.prices.map((p, i) => {
                            const vt = vehicleTypes.find((v) => v.slug === p.vehicleTypeSlug);
                            return (
                              <p
                                key={p.vehicleTypeSlug}
                                className={
                                  i === 0
                                    ? "text-2xl font-extrabold text-brand-600"
                                    : "text-xs text-gray-500"
                                }
                              >
                                {vt?.name ?? p.vehicleTypeSlug}{" "}
                                <span className={i === 0 ? "" : "font-medium text-gray-700"}>
                                  ${p.price.toFixed(0)}
                                </span>
                              </p>
                            );
                          })}
                        </div>

                        <Link
                          href="/book"
                          className="relative mt-5 rounded-full bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-600"
                        >
                          Book This
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              How It Works
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Book, drop off, relax, drive away
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, i) => (
              <div key={step.title} className="relative rounded-2xl border border-gray-100 p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-bold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StatsBand />

      <section className="bg-white py-16 text-center">
        <div className="mx-auto max-w-2xl px-4 sm:px-8">
          <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Ready for a spotless car?
          </h2>
          <p className="mt-3 text-sm text-gray-500">
            Pick a package above and book your slot — it only takes a minute.
          </p>
          <Link
            href="/book"
            className="mt-6 inline-flex rounded-full bg-brand-600 px-7 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
          >
            Book Now
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
