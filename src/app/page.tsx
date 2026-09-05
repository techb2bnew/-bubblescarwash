import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CategoryRow, Service, VehicleTypeRow } from "@/lib/types";
import { blogPosts } from "@/lib/blog-posts";
import SiteHeader from "./_components/site-header";
import BeforeAfterSlider from "./_components/before-after-slider";
import Reveal from "./_components/reveal";
import HeroSlider from "./_components/hero-slider";
import ReviewsSlider from "./_components/reviews-slider";
import SiteFooter from "./_components/site-footer";
import SectionLabel from "./_components/section-label";
import WorkshopGallerySlider from "./_components/workshop-gallery-slider";

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
    supabase
      .from("service_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("vehicle_types")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select("*, service_inclusions(inclusion_id)")
      .eq("active", true),
    supabase.from("inclusions").select("*").order("sort_order"),
  ]);

  const inclusionNameById = new Map(
    ((inclusions as { id: string; name: string }[]) ?? []).map((i) => [i.id, i.name]),
  );

  // Group service rows (one per vehicle type) into tiers by name.
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

  const vehicleOrder = new Map(
    ((vehicleTypes as VehicleTypeRow[]) ?? []).map((v, i) => [v.slug, i]),
  );
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

const chipColors = [
  "bg-amber-50 text-amber-600",
  "bg-sky-50 text-sky-600",
  "bg-violet-50 text-violet-600",
  "bg-rose-50 text-rose-600",
];

const highlights = [
  {
    title: "New car protection",
    body: "Just bought a new car? Ask about our full protection packages to keep it looking new.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path
          d="M12 2 3 6v6c0 5 4 8.5 9 10 5-1.5 9-5 9-10V6l-9-4Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m8.5 12 2.4 2.4L15.5 9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Add-ons & gift cards",
    body: "Top up your wash with extra add-ons, or grab a gift card for someone special.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 12h18M12 8v12" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 8c-2-3.5-6-2.5-6 0s4 1 6 0Zm0 0c2-3.5 6-2.5 6 0s-4 1-6 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Sale-ready detailing",
    body: "Selling your car? Come see our staff for sale-ready detailing packages that help it shine.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path
          d="M11 3h6a2 2 0 0 1 2 2v6L11 19 3 11 11 3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="15" cy="7" r="1.3" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Coffee while you wait",
    body: "Grab a fresh coffee at the cafe and relax while your car gets the full treatment.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M4 9h13a3 3 0 0 1 0 6h-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M4 9v6a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 3c-.6.8-.6 1.4 0 2.2M12 3c-.6.8-.6 1.4 0 2.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Email booking updates",
    body: "Confirmation, reminders and reschedules — straight to your inbox, no guesswork.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const trustPills = [
  {
    label: "Live slot booking",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.5 9.5h17M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Careful hand wash",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path
          d="M7 10V6a2 2 0 1 1 4 0v4M11 9V5a2 2 0 1 1 4 0v5M15 10V7a2 2 0 1 1 4 0v6c0 3.5-2.5 6-6 6h-2c-3 0-5-2-5-5v-2a2 2 0 1 1 4 0"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Transparent pricing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2 2.5-2s2.5.7 2.5 1.8c0 2.4-5 1.4-5 3.9 0 1.1 1.2 1.8 2.5 1.8s2.5-.6 2.5-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Trained detailers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Email booking updates",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path
          d="M12 3a5 5 0 0 0-5 5v3.5c0 .8-.3 1.6-.9 2.2L5 15h14l-1.1-1.3a3 3 0 0 1-.9-2.2V8a5 5 0 0 0-5-5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Gift cards",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <rect x="3" y="7" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 7v10" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 2.2" />
      </svg>
    ),
  },
  {
    label: "Add-ons",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Book Online",
    body: "Pick your vehicle, service tier and a slot that suits you — takes under a minute.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M5 3l6 15 2-6 6-2L5 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Drop Off",
    body: "Pull in at the bay, grab a coffee at the cafe, and hand the keys to our team.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <circle cx="8" cy="15" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10.5 12.5 19 4M16 7l2 2M13 10l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "We Wash & Detail",
    body: "Hand wash, interior clean and detailing to the exact package you chose.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <rect x="4" y="9" width="16" height="8" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17" cy="6" r="1.3" fill="currentColor" />
        <circle cx="19.5" cy="9" r="1" fill="currentColor" />
        <circle cx="14.5" cy="5" r="0.9" fill="currentColor" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Drive Off Spotless",
    body: "Quick quality check, then you're back on the road in a car that shines.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const galleryPhotos = [
  { src: "/real-photos/hand-wax.jpg", alt: "Detailer hand-waxing a car panel" },
  { src: "/real-photos/detail-collage.jpg", alt: "Headlight restoration and dashboard detailing" },
  { src: "/real-photos/tunnel-wash.jpg", alt: "Car going through the automatic wash tunnel" },
  { src: "/real-photos/cafe-coffee.jpg", alt: "Barista pouring latte art into a coffee cup" },
  { src: "/real-photos/headlight-polish.jpg", alt: "Hand wiping down a headlight and fender" },
];

const statBand = [
  {
    value: "15+",
    label: "Years Running",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "2",
    label: "Bays & Cafe",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M4 21V8l8-5 8 5v13" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 21v-7h6v7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "12k+",
    label: "Cars Washed",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path
          d="M4 16.5 5.2 12a2 2 0 0 1 1.9-1.4h9.8a2 2 0 0 1 1.9 1.4l1.2 4.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="3" y="16.5" width="18" height="3.5" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="7.5" cy="20" r="1" fill="currentColor" />
        <circle cx="16.5" cy="20" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    value: "4.9",
    label: "Google Rating",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
        <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7L10 1.5Z" />
      </svg>
    ),
  },
];

const serviceGrid = [
  {
    title: "Outside Wash",
    body: "Hand wash, chamois dry and tyres glossed — the essential clean.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path
          d="M5 4c3 1 4 3 3 6-1 2.5 0 4.5 2 5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M14 15a3 3 0 1 0 6 0c0-1.7-1.2-2.8-3-4.5-1.8 1.7-3 2.8-3 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Inside & Out Wash",
    body: "Outside wash plus interior dusted, vacuumed and windows cleaned.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M8 20V9a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 14h8v6H8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Superior Wash",
    body: "Inside and out plus protective wax, door jambs and detailed wheels.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M12 3c2 2.5 5 6 5 10a5 5 0 0 1-10 0c0-4 3-7.5 5-10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Mini Detail",
    body: "Superior wash plus clay bar, steam-cleaned carpets and leather condition.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M12 3v3M12 18v3M4.2 12H3M21 12h-1.2M6 6l1.2 1.2M18 18l-1.2-1.2M18 6l-1.2 1.2M6 18l1.2-1.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: "Express Detailing",
    body: "Add-ons like headlight restoration, hand wax and carpet steam clean.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path
          d="M13 2 5 13h5.5L9.5 22l9-13H13l1-7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Full Detailing",
    body: "Interior detail, cut and polish, or the full works — allow 1–4 hours.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
];


const guarantees = [
  {
    title: "100% Satisfaction",
    body: "Not happy with a spot we missed? Tell us before you leave and we'll fix it, free.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M7 11v9H4v-9h3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path
          d="M7 11l3.5-7c1 0 2 1 2 2v3h4.5a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 16 19H9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "No Hidden Fees",
    body: "The price you see when you book is the price you pay at the till.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M6 3h12v18l-2-1.2L14 21l-2-1.2L10 21l-2-1.2L6 21V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Locally Owned",
    body: "Family-run since 2011 — the same team you'll see behind the counter today.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
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
];

const careItems = [
  {
    title: "Eco-friendly shampoo",
    body: "pH-neutral formulas that clean without stripping wax or harming paint.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M5 19c0-8 4-14 14-14 0 10-6 14-14 14Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M6 18c3-3 5-6 12-11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Microfiber-only touch",
    body: "Soft mitts and towels on every panel — no scratches, no swirl marks.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path
          d="M5 5.5 8 4h8l3 1.5v5A8 8 0 0 1 12 20 8 8 0 0 1 5 10.5v-5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M9 10.5h6M9 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Premium wax & sealant",
    body: "A protective layer that keeps the shine (and the water-beading) going longer.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M12 5a7 7 0 1 1-6.3 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M4 6v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Commercial-grade vacuum",
    body: "Deep suction that gets into footwells, seams and boot corners.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <rect x="4" y="10" width="6" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10 13h5a4 4 0 0 0 4-4V7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M19 4v3M17.5 5.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default async function Home() {
  const { categories, vehicleTypes, tiers } = await getWashPackages();

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <HeroSlider />

      {/* Trust pills — overlaps the hero/white boundary like a badge strip */}
      <section className="relative z-10 bg-white">
        <div className="mx-auto -mt-16 max-w-[1600px] px-4 sm:px-8">
          <div className="grid grid-cols-2 gap-y-6 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-brand-600/10 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-6 sm:divide-y-0 sm:p-7 lg:grid-cols-7 lg:gap-x-4 lg:gap-y-0">
            {trustPills.map((p, i) => (
              <div
                key={p.label}
                className={`flex items-center gap-2.5 pt-6 sm:pt-0 lg:flex-col lg:gap-3 lg:text-center ${
                  i > 0 ? "lg:border-l lg:border-gray-100 lg:pl-4" : ""
                }`}
              >
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-600 lg:h-12 lg:w-12">
                  {p.icon}
                </span>
                <span className="text-base font-semibold text-gray-700">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About / highlights, with a stat badge over the photo */}
      <section id="why-us" className="border-b border-gray-100 bg-white">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-12 px-4 pb-14 pt-14 sm:px-8 lg:grid-cols-2 lg:items-stretch lg:gap-8">
          <div className="relative flex w-full flex-col">
            <BeforeAfterSlider
              src="/real-photos/hand-wax.jpg"
              alt="Car before and after a hand wash — drag to compare"
            />
            <p className="mt-2 text-center text-xs text-gray-400">
              Drag the slider to see the difference
            </p>
            <div className="absolute -bottom-6 -right-6 flex flex-col items-center justify-center rounded-2xl bg-brand-600 px-6 py-5 text-center text-white shadow-xl shadow-brand-600/30">
              <p className="text-3xl font-extrabold">15+</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-50">
                Years Running
              </p>
            </div>
          </div>
          <div>
            <SectionLabel align="left">Why Choose Bubbles</SectionLabel>
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
              Driving excellence in every <span className="wave-word">wash</span>
            </h2>
            <p className="mt-3 max-w-lg text-sm text-gray-500">
              We are a prestigious car wash &amp; cafe in Adelaide&apos;s north east since 2011. We
              pride ourselves as leaders in the car wash industry, providing number-one quality
              care for your vehicle, attention to detail and a pleasant customer experience — while
              caring for the environment too.
            </p>
            <div className="mt-8 space-y-6">
              {highlights.map((h, i) => (
                <div key={h.title} className="flex gap-4">
                  <div
                    className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${chipColors[i % chipColors.length]}`}
                  >
                    {h.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{h.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-500">{h.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Numbers — dark stat band */}
      <section style={{ backgroundColor: "#0b1220" }} className="relative overflow-hidden py-14">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500 opacity-10" />
        <div className="relative mx-auto max-w-[1600px] px-4 sm:px-8">
          <SectionLabel tone="dark">Our Numbers</SectionLabel>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {statBand.map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
                <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-white/5 px-4 py-6 text-center ring-1 ring-white/10 transition hover:bg-white/10">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600/20 text-brand-400">
                    {s.icon}
                  </span>
                  <p className="text-2xl font-extrabold text-white sm:text-3xl">{s.value}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Service icon grid */}
      <section className="bg-gray-50 py-14">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <Reveal><div className="mx-auto max-w-2xl text-center">
            <SectionLabel>What We Offer</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Every service, done <span className="wave-word">properly</span>
            </h2>
          </div></Reveal>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {serviceGrid.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) * 90}>
                <div className="group flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                    {s.icon}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
                  <p className="text-xs leading-relaxed text-gray-500">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Quote banner — full-width action photo with a pull quote */}
      <section className="relative isolate overflow-hidden">
        <div className="relative h-80 w-full sm:h-[28rem]">
          <Image
            src="/real-photos/detail-collage.jpg"
            alt="Headlight and interior detailing in progress"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gray-950/70" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-brand-400/70 sm:h-12 sm:w-12">
              <path d="M9 7C6 7 4 9.5 4 13c0 2.5 2 4.5 4.5 4.5S13 15.5 13 13c0-1.6-1-3-2.5-3.4C10.8 8 12 7 14 7V4.5C11 4.5 9 5.8 9 7Zm10 0c-3 0-5 2.5-5 6 0 2.5 2 4.5 4.5 4.5S23 15.5 23 13c0-1.6-1-3-2.5-3.4C20.8 8 22 7 24 7V4.5c-3 0-5 1.3-5 2.5Z" />
            </svg>
            <p className="mt-4 max-w-4xl text-[25px] font-extrabold leading-snug">
              &ldquo;We treat every car like it&apos;s about to be judged in a car show.&rdquo;
            </p>
            <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-brand-300 sm:text-base">
              — The Bubbles Team
            </p>
          </div>
        </div>
      </section>

      {/* Workshop & Gallery — circular photo showcase */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <Reveal><div className="mx-auto max-w-2xl text-center">
            <SectionLabel>Workshop &amp; Gallery</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              A closer look at our <span className="wave-word">craft</span>
            </h2>
          </div></Reveal>
          <WorkshopGallerySlider photos={galleryPhotos} />
        </div>
      </section>

      {/* How It Works */}
      <section style={{ backgroundColor: "#0b1220" }} className="relative overflow-hidden py-14">
        <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-brand-500 opacity-10" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-brand-400 opacity-10" />
        <div className="relative mx-auto max-w-[1600px] px-4 sm:px-8">
          <Reveal><div className="mx-auto max-w-2xl text-center">
            <SectionLabel tone="dark">How It Works</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              Booking to spotless in four <span className="wave-word wave-word-dark">steps</span>
            </h2>
          </div></Reveal>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((s, i) => (
              <div key={s.step} className="relative text-center">
                {i < howItWorks.length - 1 && (
                  <span className="absolute left-1/2 top-9 hidden h-px w-full bg-white/10 lg:block" />
                )}
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-brand-400 ring-1 ring-white/10">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600/20 text-brand-300">
                    {s.icon}
                  </span>
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                    {s.step}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Guarantee — white breather section between the two dark bands */}
      <section className="bg-gray-50 py-12">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <Reveal><div className="mx-auto max-w-2xl text-center">
            <SectionLabel>Our Guarantee</SectionLabel>
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
              What every visit comes <span className="wave-word">with</span>
            </h2>
          </div></Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {guarantees.map((g, i) => (
              <Reveal key={g.title} delay={i * 100}>
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${chipColors[i % chipColors.length]}`}>
                    {g.icon}
                  </span>
                  <h3 className="text-base font-bold text-gray-900">{g.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{g.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section style={{ backgroundColor: "#0b1220" }} className="py-14">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-8 px-4 sm:px-8 lg:grid-cols-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/real-photos/hand-wax.jpg"
              className="absolute inset-0 h-full w-full object-cover"
            >
              <source
                src="https://videos.pexels.com/video-files/4863281/4863281-hd_1920_1080_30fps.mp4"
                type="video/mp4"
              />
            </video>
            <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-gray-950/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M8 5v14l11-7Z" />
              </svg>
              Live at the wash bay
            </span>
          </div>
          <div>
            <SectionLabel align="left" tone="dark">Our Mission</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              Making the world&apos;s next car wash <span className="wave-word wave-word-dark">friendly</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm text-gray-400">
              We want every visit to feel effortless — book online, drop off, and relax with a
              coffee while trained hands take care of the rest. No upsells, no surprises, just a
              spotless car every time.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-block rounded-full bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Services (dynamic) */}
      <section id="services" className="bg-gray-50 py-14">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <Reveal><div className="mx-auto max-w-2xl text-center">
            <SectionLabel>Our Packages</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              A wash for every kind of <span className="wave-word">clean</span>
            </h2>
            <p className="mt-3 text-sm text-gray-500">
              Pricing shown per vehicle size. Every package and price below is managed live from
              our booking system — update it any time from the admin panel.
            </p>
            <Link
              href="/services"
              className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              View full services &amp; pricing →
            </Link>
          </div></Reveal>

          {tiers.length === 0 ? (
            <p className="mt-10 text-center text-sm text-gray-500">
              Packages are being updated — please check back shortly.
            </p>
          ) : (
            categories.map((cat) => {
              const catTiers = tiers.filter((t) => t.category === cat.slug);
              if (catTiers.length === 0) return null;
              return (
                <div key={cat.slug} className="mt-10">
                  <h3 className="text-lg font-bold text-gray-900">{cat.name}</h3>
                  <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {catTiers.map((tier, idx) => {
                      const featured = idx === 1;
                      return (
                        <div
                          key={tier.name}
                          className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                            featured
                              ? "border-brand-300 shadow-lg shadow-brand-600/10 ring-2 ring-brand-500 sm:-translate-y-2"
                              : "border-gray-100"
                          }`}
                        >
                          <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-50" />
                          {featured && (
                            <span className="absolute right-4 top-4 rounded-full bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                              Most Popular
                            </span>
                          )}
                          <div className="relative">
                            <h4 className="text-base font-bold text-gray-900">{tier.name}</h4>
                            <p className="mt-1 text-xs text-gray-400">~{tier.duration_minutes} min</p>
                          </div>

                          {tier.features.length > 0 && (
                            <ul className="relative mt-4 space-y-1.5 text-sm text-gray-600">
                              {tier.features.slice(0, 5).map((f) => (
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
                            className={`relative mt-5 rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white transition ${
                              featured ? "bg-brand-600 hover:bg-brand-700" : "bg-gray-900 hover:bg-brand-600"
                            }`}
                          >
                            Book This
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* What we use */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <Reveal><div className="mx-auto max-w-2xl text-center">
            <SectionLabel>What We Use</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Good products, used <span className="wave-word">properly</span>
            </h2>
          </div></Reveal>
          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {careItems.map((c, i) => (
              <Reveal key={c.title} delay={i * 90}>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${chipColors[i % chipColors.length]}`}
                  >
                    {c.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-gray-900">{c.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Loyalty promo banner — moody wash photo + the real "Buy 4 & Get 1 Free" graphic, shown large */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/real-photos/detail-collage.jpg"
            alt="Headlight and interior detailing in progress"
            fill
            sizes="100vw"
            className="object-cover grayscale"
          />
          <div className="absolute inset-0 bg-[#0b1220]/70" />
        </div>
        <div className="relative mx-auto flex max-w-[1600px] flex-col items-center gap-10 px-4 py-16 sm:px-8 sm:py-20 lg:flex-row lg:justify-between">
          <div className="max-w-xl text-center lg:text-left">
            <h2 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              We&apos;ll Clean the Mud
              <br />
              Off Your Dirty Car!
            </h2>
            <p className="mt-4 text-sm text-gray-300 sm:text-base">
              Our car wash has a variety of premium-quality services, that your car (and your
              wallet) will love!
            </p>
          </div>
          <div className="relative h-56 w-56 flex-none overflow-hidden rounded-2xl ring-4 ring-brand-500 sm:h-64 sm:w-64">
            <Image
              src="/real-photos/loyalty-buy4-promo.png"
              alt="Buy 4 washes and get 1 free — ask in store"
              fill
              sizes="256px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Apply for a Car Wash */}
      <section className="bg-gray-50 py-12">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-8 px-4 sm:px-8 lg:grid-cols-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl">
            <Image
              src="/real-photos/detail-collage.jpg"
              alt="Headlight and interior detailing, ready to take a booking"
              fill
              sizes="(max-width: 1024px) 100vw, 768px"
              className="object-cover"
            />
          </div>
          <div>
            <SectionLabel align="left">Book An Appointment</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Apply for a Car <span className="wave-word">Wash</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm text-gray-500">
              Skip the wait — reserve your bay online and pick the exact time that suits you.
              Prefer to talk it through first? Give the team a call.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/book"
                className="rounded-full bg-brand-600 px-8 py-4 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
              >
                Book a Wash
              </Link>
              <a
                href="tel:0870805959"
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-brand-600"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
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
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="bg-white py-14">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <Reveal><div className="mx-auto max-w-2xl text-center">
            <SectionLabel>Reviews</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              What Adelaide is <span className="wave-word">saying</span>
            </h2>
          </div></Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[0.55fr_1.45fr] lg:items-start">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <svg viewBox="0 0 48 48" className="h-9 w-9 flex-none">
                <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h11.9c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.9 6.5-9.6 6.5-16.7z" />
                <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z" />
                <path fill="#FBBC05" d="M11.6 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.9l7.3-5.7z" />
                <path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 7 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z" />
              </svg>
              <div>
                <p className="text-2xl font-extrabold text-gray-900">4.9</p>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} viewBox="0 0 20 20" fill="#fbbc05" className="h-3.5 w-3.5">
                      <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7L10 1.5Z" />
                    </svg>
                  ))}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">Google Rating</p>
              </div>
            </div>
            <div className="flex items-center">
              <ReviewsSlider
                reviews={[
                  {
                    name: "Katharesan Narasamy",
                    meta: "6 reviews",
                    time: "2 months ago",
                    quote: "Very efficient, customer orientated service. Keep up the service.",
                  },
                  {
                    name: "Mars",
                    meta: "Local Guide · 53 reviews",
                    time: "a month ago",
                    quote:
                      "Great value, the staff really do a fantastic job of cleaning your car. Highly recommended.",
                  },
                  {
                    name: "Josephine Virgara",
                    meta: "2 reviews",
                    time: "a year ago",
                    quote:
                      "Don't usually leave reviews but I love this place! They are always super thorough and get out all the pet hair. Fairly priced too and staff is friendly :)",
                  },
                  {
                    name: "Brandon",
                    meta: "Local Guide · 90 reviews",
                    time: "a year ago",
                    quote:
                      "Fantastic service, very clean. Good price. Booked in a spot for me last minute — the seats looked very clean and fresh.",
                  },
                  {
                    name: "Jack Dillon",
                    meta: "9 reviews",
                    time: "8 months ago",
                    quote: "Great pricing, attention to detail and customer service. Coffee is good too.",
                  },
                  {
                    name: "Tree Stockley",
                    meta: "28 reviews",
                    time: "8 months ago",
                    quote:
                      "Top job, just bought a second hand car for our daughter which needed a complete do over on the inside. Even though they were flat out they still found time for us. Thanks guys!",
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Blog & News */}
      <section className="bg-gray-50 py-14">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <Reveal><div className="mx-auto max-w-2xl text-center">
            <SectionLabel>Blog &amp; News</SectionLabel>
            <h2 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Tips and latest <span className="wave-word">news</span>
            </h2>
          </div></Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {blogPosts.map((t, i) => (
              <Reveal key={t.slug} delay={i * 100}>
                <Link
                  href={`/blog/${t.slug}`}
                  className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <Image
                      src={t.image}
                      alt={t.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 360px"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                      {t.dateLabel} · {t.category}
                    </p>
                    <h3 className="mt-2 text-base font-bold text-gray-900">{t.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-gray-500">{t.excerpt}</p>
                    <span className="mt-3 inline-block text-xs font-semibold text-brand-600">
                      Read more →
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Visit Us photo banner */}
      <section id="visit" className="relative isolate overflow-hidden">
        <div className="relative h-80 w-full sm:h-[26rem]">
          <Image
            src="/real-photos/cafe-coffee.jpg"
            alt="Cozy cafe counter interior at Bubbles Car Wash & Cafe"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/55 to-gray-950/30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/15">
              Grab a Seat
            </span>
            <h2 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
              Coffee, cake, and a clean car — all in one stop
            </h2>
            <p className="mt-3 max-w-md text-sm text-gray-300">
              Order a fresh brew from our cafe counter while our team gets to work on your vehicle.
            </p>
            <Link
              href="/gallery"
              className="mt-7 rounded-full bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
            >
              See the Cafe &amp; Gallery
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
