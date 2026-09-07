import Image from "next/image";
import MarqueeBand from "../_components/marquee-band";
import Link from "next/link";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";
import SectionLabel from "../_components/section-label";
import { blogPosts } from "@/lib/blog-posts";

export const metadata = {
  title: "Blog & News — Bubbles Car Wash & Cafe",
  description:
    "Wash tips, detailing advice and news from Bubbles Car Wash & Cafe, Adelaide's north east since 2011.",
};

export default function BlogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section style={{ backgroundColor: "#0b1220" }} className="py-16 text-center text-white sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-8">
          <SectionLabel tone="dark">Blog &amp; News</SectionLabel>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Tips and Latest <span className="wave-word wave-word-dark">News</span>
          </h1>
          <p className="mt-4 text-sm text-gray-400">
            Wash tips, detailing advice and news from the Bubbles team.
          </p>
        </div>
      </section>

      <MarqueeBand />

      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                    {post.dateLabel} · {post.category}
                  </p>
                  <h2 className="mt-2 text-base font-bold text-gray-900">{post.title}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">{post.excerpt}</p>
                  <span className="mt-3 inline-block text-xs font-semibold text-brand-600">
                    Read more →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
