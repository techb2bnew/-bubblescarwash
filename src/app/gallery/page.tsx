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
const photos = [
  {
    src: "https://images.pexels.com/photos/6873179/pexels-photo-6873179.jpeg",
    alt: "Detailer washing a car covered in foam",
    caption: "Full foam soak before the hand wash",
    col: 2,
    row: 2,
  },
  {
    src: "https://images.pexels.com/photos/6873020/pexels-photo-6873020.jpeg",
    alt: "Close-up of hand washing a car with a brush",
    caption: "Every panel scrubbed by hand",
    col: 1,
    row: 1,
  },
  {
    src: "https://images.pexels.com/photos/4906424/pexels-photo-4906424.jpeg",
    alt: "Cozy cafe counter interior",
    caption: "The cafe counter",
    col: 1,
    row: 1,
  },
  {
    src: "https://images.pexels.com/photos/364305/pexels-photo-364305.jpeg",
    alt: "Close-up of a clean car wheel and tyre",
    caption: "Mag wheels detailed, tyres finished",
    col: 1,
    row: 1,
  },
  {
    src: "https://images.pexels.com/photos/14689178/pexels-photo-14689178.jpeg",
    alt: "Fresh cafe latte",
    caption: "Fresh coffee while you wait",
    col: 1,
    row: 1,
  },
  {
    src: "https://images.pexels.com/photos/5233285/pexels-photo-5233285.jpeg",
    alt: "Vacuuming a car seat",
    caption: "Interior vacuum, seats to boot",
    col: 2,
    row: 1,
  },
  {
    src: "https://images.pexels.com/photos/5233259/pexels-photo-5233259.jpeg",
    alt: "Detailer polishing a car",
    caption: "Cut & polish detailing",
    col: 2,
    row: 1,
  },
];

export default function GalleryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section className="border-b border-gray-100 bg-gray-50 py-16 text-center">
        <div className="mx-auto max-w-2xl px-4 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Gallery</p>
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            The wash, the detail, the coffee
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            A behind-the-scenes look at what happens between drop-off and pickup.
          </p>
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
          <h2 className="text-2xl font-extrabold sm:text-3xl">See it for yourself</h2>
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
