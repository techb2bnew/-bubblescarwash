import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <Image
        src="/Bubbles-Logo.png"
        alt="Bubbles Car Wash & Cafe"
        width={641}
        height={428}
        priority
        className="h-28 w-auto sm:h-36"
      />
      <p className="mt-3 max-w-md text-gray-600">
        Book a wash or detailing service in just a few clicks.
      </p>
      <Link
        href="/book"
        className="mt-8 rounded-md bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Book Online
      </Link>
    </div>
  );
}
