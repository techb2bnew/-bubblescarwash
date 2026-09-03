import { getGiftCardPaymentStatus } from "../actions";
import GiftCardConfirmationStatus from "./gift-card-confirmation-status";

export const dynamic = "force-dynamic";

export default async function GiftCardConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ gift_card_id?: string }>;
}) {
  const { gift_card_id: giftCardId } = await searchParams;
  const initial = giftCardId ? await getGiftCardPaymentStatus(giftCardId) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      {giftCardId ? (
        <GiftCardConfirmationStatus giftCardId={giftCardId} initial={initial} />
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-800">Gift card not found</h1>
          <p className="mt-2 text-sm text-red-700">
            No gift card reference was provided.
          </p>
        </div>
      )}
    </div>
  );
}
