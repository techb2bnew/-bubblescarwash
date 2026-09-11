import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";

export const metadata = {
  title: "Gallery — Bubbles Car Wash & Cafe",
  description: "A look at the wash, detailing and cafe experience at Bubbles Car Wash & Cafe.",
};

// `col` / `row` control how many grid tracks each tile spans, giving the
// bento/masonry look (big feature tiles mixed with small square ones)
// instead of a uniform grid of equal cards.
const photos: {
  src: string;
  alt: string;
  caption: string;
  col: number;
  row: number;
  position?: string;
}[] = [
  {
    src: "/real-photos/gallery-storefront.png",
    alt: "Bubbles Car Wash & Cafe storefront and hand wash bay",
    caption: "Our storefront on North East Rd",
    col: 2,
    row: 2,
  },
  {
    src: "/real-photos/gallery-ferrari-cafe.png",
    alt: "A classic car parked outside the Bubbles cafe windows",
    caption: "Every car gets the same care",
    col: 2,
    row: 1,
  },
  {
    src: "/real-photos/gallery-cafe-seating.png",
    alt: "Cafe seating booth inside Bubbles",
    caption: "Grab a seat while you wait",
    col: 1,
    row: 1,
  },
  {
    src: "/real-photos/gallery-hallway.png",
    alt: "Cafe hallway and seating area",
    caption: "Relax with a coffee",
    col: 1,
    row: 1,
  },
  {
    src: "/real-photos/gallery-waiting-room.png",
    alt: "Customer waiting area with coffee machine",
    caption: "Our waiting area",
    col: 1,
    row: 1,
  },
  {
    src: "/real-photos/hand-wax.jpg",
    alt: "Detailer hand-waxing a car panel",
    caption: "Hand wax & polish finish",
    col: 1,
    row: 1,
  },
  {
    src: "/real-photos/headlight-polish.jpg",
    alt: "Hand wiping down a headlight and fender",
    caption: "Every panel wiped by hand",
    col: 1,
    row: 1,
  },
  {
    src: "/real-photos/tunnel-wash.jpg",
    alt: "Car passing through the automatic wash tunnel",
    caption: "Through the wash tunnel",
    col: 1,
    row: 1,
  },
];

export default function GalleryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section className="relative isolate overflow-hidden">
        <div className="relative h-64 w-full sm:h-80">
          <Image
            src="/real-photos/gallery-storefront.png"
            alt="Bubbles Car Wash & Cafe storefront"
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/80 to-[#0b1220]/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">Gallery</p>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              The wash, the detail, the <span className="wave-word wave-word-dark">coffee</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-gray-300">
              A behind-the-scenes look at what happens between drop-off and pickup.
            </p>
          </div>
        </div>
      </section>


      <section className="py-16">
        <div
          className="mx-auto grid max-w-[1600px] grid-cols-2 gap-4 px-4 sm:px-8 sm:grid-cols-4"
          style={{ gridAutoFlow: "dense", gridAutoRows: "160px" }}
        >
          {photos.map((p) => (
            <figure
              key={p.src}
              className="group relative overflow-hidden rounded-2xl bg-gray-100 shadow-sm transition hover:shadow-md"
              style={{
                gridColumn: `span ${p.col}`,
                gridRow: `span ${p.row}`,
              }}
            >
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition duration-300 group-hover:scale-105"
                style={p.position ? { objectPosition: p.position } : undefined}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
              <figcaption className="absolute inset-x-0 bottom-0 p-3 text-xs font-medium text-white sm:text-sm">
                {p.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section style={{ backgroundColor: "#0b1220" }} className="py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-8">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            See it for <span className="wave-word wave-word-dark">yourself</span>
          </h2>
          <p className="mt-3 text-sm text-gray-400">
            Book online and pick the package that matches your car.
          </p>
          <Link
            href="/book"
            className="mt-6 inline-flex rounded-full bg-brand-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
          >
            Book a Wash
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
