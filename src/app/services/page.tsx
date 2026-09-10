import Image from "next/image";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import type { ServiceCategoryRow, VehicleTypeRow } from "@/lib/types";
import { flattenServiceTemplates, type ServiceTemplateRow } from "@/lib/pricing";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";
import StatsBand from "../_components/stats-band";
import PackagesTabs from "../_components/packages-tabs";

export const metadata = {
  title: "Services & Pricing — Bubbles Car Wash & Cafe",
  description: "Every wash and detailing package at Bubbles Car Wash & Cafe, with live pricing per vehicle size.",
};

export const revalidate = 60;

type Tier = {
  name: string;
  category_id: string;
  duration_minutes: number;
  prices: { vehicleTypeSlug: string; price: number }[];
  features: string[];
};

async function getWashPackages() {
  const supabase = createPublicClient();

  const [{ data: vehicleTypes }, { data: services }, { data: categories }] = await Promise.all([
    supabase.from("vehicle_types").select("*").eq("active", true).order("sort_order"),
    supabase
      .from("services")
      .select("*, prices:service_prices(*), inclusions(*)")
      .eq("active", true)
      .order("name"),
    supabase.from("service_categories").select("*").eq("active", true).order("sort_order"),
  ]);

  const flatServices = flattenServiceTemplates(
    (services as ServiceTemplateRow[]) ?? [],
  );

  const tiersByName = new Map<string, Tier>();
  for (const s of flatServices) {
    const existing = tiersByName.get(s.name);
    const features = (s.inclusions ?? [])
      .filter((i) => i.active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => i.name);

    if (existing) {
      existing.prices.push({ vehicleTypeSlug: s.vehicle_type, price: s.price });
      if (features.length > existing.features.length) existing.features = features;
    } else {
      tiersByName.set(s.name, {
        name: s.name,
        category_id: s.category_id,
        duration_minutes: s.duration_minutes,
        prices: [{ vehicleTypeSlug: s.vehicle_type, price: s.price }],
        features,
      });
    }
  }

  const vehicleOrder = new Map(((vehicleTypes as VehicleTypeRow[]) ?? []).map((v, i) => [v.slug, i]));
  const tiers = [...tiersByName.values()]
    .map((t) => ({
      ...t,
      prices: t.prices.sort(
        (a, b) => (vehicleOrder.get(a.vehicleTypeSlug) ?? 0) - (vehicleOrder.get(b.vehicleTypeSlug) ?? 0),
      ),
    }))
    .sort((a, b) => (a.prices[0]?.price ?? 0) - (b.prices[0]?.price ?? 0));

  return {
    vehicleTypes: (vehicleTypes as VehicleTypeRow[]) ?? [],
    categories: (categories as ServiceCategoryRow[]) ?? [],
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
  const { vehicleTypes, categories, tiers } = await getWashPackages();

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
              Every wash and detail, priced <span className="wave-word wave-word-dark">live</span>
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
              src="/real-photos/hand-wax.jpg"
              alt="Detailer hand-waxing a car panel"
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
            <PackagesTabs categories={categories} tiers={tiers} vehicleTypes={vehicleTypes} />
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
              Book, drop off, relax, drive <span className="wave-word">away</span>
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
            Ready for a spotless <span className="wave-word">car?</span>
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
