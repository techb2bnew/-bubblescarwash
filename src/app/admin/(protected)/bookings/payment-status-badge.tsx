import type { BookingType, PaymentStatus } from "@/lib/types";

const STYLES: Record<PaymentStatus, string> = {
  paid: "bg-green-50 text-green-700 ring-green-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  unpaid: "bg-gray-100 text-gray-500 ring-gray-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  refunded: "bg-purple-50 text-purple-700 ring-purple-200",
};

const LABELS: Record<PaymentStatus, string> = {
  paid: "Paid",
  pending: "Pending",
  unpaid: "Unpaid",
  failed: "Failed",
  refunded: "Refunded",
};

export default function PaymentStatusBadge({
  paymentStatus,
  bookingType,
}: {
  paymentStatus: PaymentStatus;
  bookingType: BookingType;
}) {
  if (bookingType === "offline" && paymentStatus === "unpaid") {
    return <span className="text-xs text-gray-400">Manual</span>;
  }

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[paymentStatus]}`}
    >
      {LABELS[paymentStatus]}
    </span>
  );
}
