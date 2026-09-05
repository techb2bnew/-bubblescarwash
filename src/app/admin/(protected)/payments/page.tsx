import { createClient } from "@/lib/supabase/server";
import PaymentsTable, { type PaymentRecord } from "./payments-table";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();

  const [{ data: bookings }, { data: giftCards }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, customer_name, customer_email, price, payment_status, booking_type, card_brand, card_last4, receipt_url, created_at, services(name)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("gift_cards")
      .select(
        "id, purchaser_name, purchaser_email, value, payment_status, card_brand, card_last4, receipt_url, created_at, gift_card_products(name)",
      )
      .order("created_at", { ascending: false }),
  ]);

  const bookingRecords: PaymentRecord[] = (bookings ?? []).map((b) => ({
    id: b.id,
    type: "booking",
    date: b.created_at,
    name: b.customer_name,
    email: b.customer_email,
    description: (b.services as unknown as { name: string } | null)?.name ?? "Booking",
    amount: b.price,
    paymentStatus: b.payment_status,
    bookingType: b.booking_type,
    cardBrand: b.card_brand,
    cardLast4: b.card_last4,
    receiptUrl: b.receipt_url,
  }));

  const giftCardRecords: PaymentRecord[] = (giftCards ?? []).map((g) => ({
    id: g.id,
    type: "gift_card",
    date: g.created_at,
    name: g.purchaser_name,
    email: g.purchaser_email,
    description: (g.gift_card_products as unknown as { name: string } | null)?.name ?? "Gift Card",
    amount: g.value,
    paymentStatus: g.payment_status,
    bookingType: "online",
    cardBrand: g.card_brand,
    cardLast4: g.card_last4,
    receiptUrl: g.receipt_url,
  }));

  const records = [...bookingRecords, ...giftCardRecords].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Payments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every booking and gift card transaction, with card and receipt details where available.
        </p>
      </div>

      <PaymentsTable records={records} />
    </div>
  );
}
