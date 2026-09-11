export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  dateLabel: string;
  excerpt: string;
  image: string;
  /** Wider photo for the post's own banner — the card thumbnail is too low-res to stretch full-width without blurring. */
  bannerImage: string;
  content: string[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "avoiding-scratches-and-swirl-marks",
    title: "Avoiding scratches and swirl marks",
    category: "General",
    dateLabel: "Wash Tips",
    excerpt:
      "Why we only use microfiber mitts and two-bucket washing to keep your paint scratch-free.",
    image: "/real-photos/blog-mitt-wash.png",
    bannerImage: "/real-photos/foam-wash-banner.png",
    content: [
      "Swirl marks — those fine, spiderweb-like scratches you notice under bright light or direct sun — are almost always caused by dirt being dragged across the paint rather than lifted away from it. A single gritty wash mitt, reused pass after pass without rinsing, is one of the most common culprits.",
      "That's why every wash at Bubbles starts with a proper pre-rinse to knock off loose grit before a mitt ever touches the panel, and why we wash with the two-bucket method: one bucket of clean, soapy water for loading the mitt, and a second bucket of plain water for rinsing the mitt clean before it goes back in the soap. It sounds simple, but it's the single biggest factor in keeping the sand and road grime that causes swirls out of the wash process entirely.",
      "We also stick to genuine microfiber mitts rather than sponges or the stiff brushes you'd find at a coin-op bay. Microfiber fibres are soft and hold dirt particles away from the paint surface as they're lifted off, instead of grinding them straight into the clear coat.",
      "A few things you can do between visits: rinse off bird droppings and tree sap as soon as you notice them rather than letting them bake on in the sun, and avoid automatic brush washes where the same brushes scrub every car that goes through — they pick up grit from previous vehicles and carry it straight onto yours.",
      "If your car already has light swirl marks, a Star Polish or a full detail with clay bar treatment can correct a lot of that fine scratching and bring back real depth to the paint. Ask our team which package makes sense for the condition your car is in.",
    ],
  },
  {
    slug: "what-a-good-car-wash-should-never-skip",
    title: "What a good car wash should never skip",
    category: "Auto Detailing",
    dateLabel: "Wash Tips",
    excerpt:
      "The checklist we run through on every vehicle — from pre-rinse to a final panel wipe-down.",
    image: "/real-photos/blog-hand-wax.png",
    bannerImage: "/real-photos/foam-red-car.png",
    content: [
      "It's easy to assume every car wash does roughly the same thing, but the steps that get skipped are usually the ones that matter most for actually protecting your paint over time — not just making the car look clean for the drive home.",
      "Every wash we run follows the same order for a reason: a full pre-rinse first, to remove loose dirt before any contact wash begins. Then a pH-neutral shampoo wash using the two-bucket method, followed by a dedicated pass on the wheels and tyres — always done with separate equipment to the panels, since brake dust is abrasive and shouldn't be anywhere near the mitt that just touched your paintwork.",
      "After the rinse, drying matters more than most people expect. Letting a car air-dry in the sun leaves mineral deposits and water spots baked into the clear coat. We dry with clean microfiber towels and finish door jambs and shut lines by hand, since that's where grit tends to collect and get missed.",
      "A tyre shine and a final panel wipe-down round things out — small steps, but they're what separates a wash that looks good for a day from one that actually protects the car until the next visit.",
      "If you're comparing car washes, ask what their process actually includes rather than just the price. A cheaper wash that skips the pre-rinse or reuses the same wheel brush on the paintwork can do more harm than good over time.",
    ],
  },
  {
    slug: "getting-the-interior-properly-dust-free",
    title: "Getting the interior properly dust-free",
    category: "Interior",
    dateLabel: "Wash Tips",
    excerpt:
      "Where dust and crumbs actually hide, and the vacuum technique that gets them out for good.",
    image: "/real-photos/blog-interior-vacuum.png",
    bannerImage: "/real-photos/muddy-suv-wash.png",
    content: [
      "Most of the dust and grit in a car's interior isn't sitting on the surface where a quick once-over with a vacuum nozzle can reach it — it's packed into the seams of the seats, wedged under the runners, and settled into the door pockets and cup holder recesses.",
      "Our approach starts with a commercial-grade vacuum with strong suction, worked systematically: floor mats out first and cleaned separately, then footwells, then seats (including the gap where the backrest meets the base, which collects more crumbs than almost anywhere else in the car), then door trims and pockets, and finally the dash and console using brush attachments to get into vents and buttons without scratching anything.",
      "Interior windows and mirrors get a separate glass clean at the end — doing it earlier just means dust resettles on the glass from the vacuuming and dusting that follows.",
      "For pet hair specifically, plain suction often isn't enough since hair embeds into fabric weave. A rubber-tipped attachment or a light agitation pass before vacuuming lifts embedded hair far more effectively than vacuuming alone.",
      "If it's been a while between details, a Star Polish or full interior detail with a steam clean will get carpets and seats properly reset — steam breaks down grime that a vacuum alone can't reach, especially in high-traffic footwell areas.",
    ],
  },
];

export function getBlogPost(slug: string) {
  return blogPosts.find((p) => p.slug === slug);
}
