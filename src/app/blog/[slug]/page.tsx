import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../_components/site-header";
import SiteFooter from "../../_components/site-footer";
import { blogPosts, getBlogPost } from "@/lib/blog-posts";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Blog — Bubbles Car Wash & Cafe" };
  return {
    title: `${post.title} — Bubbles Car Wash & Cafe`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const categories = [...new Set(blogPosts.map((p) => p.category))];
  const morePosts = blogPosts.filter((p) => p.slug !== post.slug);

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      {/* Featured banner */}
      <section className="relative isolate overflow-hidden">
        <div className="relative h-72 w-full sm:h-96">
          <Image
            src={post.image}
            alt={post.title}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/70 to-[#0b1220]/30" />
          <div className="absolute inset-0 flex flex-col items-center justify-end px-4 pb-10 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
              {post.dateLabel} · {post.category}
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-extrabold sm:text-4xl">{post.title}</h1>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_300px]">
          {/* Article content */}
          <article className="min-w-0">
            <Link href="/blog" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              ← Back to Blog &amp; News
            </Link>
            <div className="prose-p:mt-4 mt-6 space-y-4 text-sm leading-relaxed text-gray-600">
              {post.content.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-brand-100 bg-brand-50 p-6 text-center">
              <h2 className="text-lg font-bold text-gray-900">Ready for a spotless car?</h2>
              <p className="mt-1 text-sm text-gray-600">
                Book online in under a minute and let our team take care of the rest.
              </p>
              <Link
                href="/book"
                className="mt-4 inline-block rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Book a Wash
              </Link>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-8">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                Categories
              </h3>
              <ul className="mt-3 space-y-2">
                {categories.map((c) => (
                  <li key={c}>
                    <span className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      {c}
                      <span className="text-xs text-gray-400">
                        {blogPosts.filter((p) => p.category === c).length}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                Recent Posts
              </h3>
              <ul className="mt-3 space-y-4">
                {morePosts.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/blog/${p.slug}`} className="group flex gap-3">
                      <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg">
                        <Image src={p.image} alt={p.title} fill sizes="56px" className="object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                          {p.category}
                        </p>
                        <p className="line-clamp-2 text-sm font-semibold text-gray-800 transition group-hover:text-brand-600">
                          {p.title}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                Bubbles Car Wash &amp; Cafe
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Adelaide&apos;s north east since 2011 — book a wash and grab a coffee while you
                wait.
              </p>
              <Link
                href="/book"
                className="mt-4 inline-block rounded-full bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                Book Now
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
