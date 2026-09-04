import SiteHeader from "../../_components/site-header";
import SiteFooter from "../../_components/site-footer";
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
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-16">
        <div className="mx-auto w-full max-w-lg">
          {giftCardId ? (
            <GiftCardConfirmationStatus giftCardId={giftCardId} initial={initial} />
          ) : (
            <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center shadow-sm">
              <h1 className="text-lg font-bold text-red-800">Gift card not found</h1>
              <p className="mt-2 text-sm text-red-700">
                No gift card reference was provided.
              </p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
