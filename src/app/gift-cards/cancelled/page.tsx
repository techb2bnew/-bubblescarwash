import Link from "next/link";
import { cancelUnpaidGiftCard } from "../actions";

export const dynamic = "force-dynamic";

export default async function GiftCardCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ gift_card_id?: string }>;
}) {
  const { gift_card_id: giftCardId } = await searchParams;
  if (giftCardId) {
    await cancelUnpaidGiftCard(giftCardId);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Payment cancelled</h1>
        <p className="mt-2 text-sm text-gray-600">
          You weren&apos;t charged and no gift card was issued.
        </p>
        <Link
          href="/gift-cards"
          className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
