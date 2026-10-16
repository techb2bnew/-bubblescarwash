import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

/** What we know about a completed payment, for the receipt email + PDF. */
export interface PaymentReceiptInfo {
  amount: number | null;
  currency: string;
  /** e.g. "Visa •••• 5275", or null when the method has no card (Stripe Link). */
  methodLabel: string | null;
  paidAtLabel: string | null;
  reference: string | null;
  /** Stripe's hosted receipt page. */
  receiptUrl: string | null;
}

export interface ReceiptPdfInput {
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  bookingDate: string;
  bookingTimeLabel: string;
  bookingId: string;
  payment: PaymentReceiptInfo;
}

// The standard PDF fonts only cover WinAnsi; anything outside it (emoji, some
// punctuation) would throw while drawing, so swap it for a plain "?".
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of safe(text)) {
    if (font.widthOfTextAtSize(line + ch, size) > maxWidth && line) {
      out.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) out.push(line);
  return out;
}

export async function buildReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.09, 0.15);
  const grey = rgb(0.42, 0.45, 0.5);
  const accent = rgb(0.976, 0.463, 0.059);
  const left = 50;
  const right = 545;
  let y = 790;

  const text = (s: string, x: number, yy: number, size: number, font = regular, color = ink) =>
    page.drawText(safe(s), { x, y: yy, size, font, color });

  text(input.businessName, left, y, 20, bold);
  y -= 18;
  for (const l of [input.businessAddress, input.businessPhone].filter(Boolean) as string[]) {
    text(l, left, y, 10, regular, grey);
    y -= 14;
  }

  y -= 14;
  page.drawRectangle({ x: left, y: y - 6, width: right - left, height: 2, color: accent });
  y -= 36;
  text("PAYMENT RECEIPT", left, y, 16, bold);
  y -= 34;

  const { payment } = input;
  const amountText =
    payment.amount != null
      ? `$${payment.amount.toFixed(2)} ${payment.currency.toUpperCase()}`
      : "—";
  text("Amount paid", left, y, 10, regular, grey);
  y -= 26;
  text(amountText, left, y, 26, bold);
  y -= 40;

  const rows: [string, string][] = [
    ["Customer", input.customerName],
    ["Email", input.customerEmail],
    ["Service", input.serviceName],
    ["Appointment", `${input.bookingDate}, ${input.bookingTimeLabel}`],
    ...(payment.methodLabel ? ([["Payment method", payment.methodLabel]] as [string, string][]) : []),
    ...(payment.paidAtLabel ? ([["Date paid", payment.paidAtLabel]] as [string, string][]) : []),
    ...(payment.reference ? ([["Payment reference", payment.reference]] as [string, string][]) : []),
    ["Booking ID", input.bookingId],
  ];
  for (const [label, value] of rows) {
    page.drawLine({ start: { x: left, y: y + 14 }, end: { x: right, y: y + 14 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.93) });
    text(label, left, y, 10, regular, grey);
    const lines = wrap(value, bold, 11, right - left - 150);
    lines.forEach((l, i) => text(l, left + 150, y - i * 14, 11, bold));
    y -= 14 + Math.max(0, lines.length - 1) * 14 + 12;
  }

  y -= 14;
  if (payment.receiptUrl) {
    text("Official Stripe receipt:", left, y, 9, bold, grey);
    y -= 13;
    for (const l of wrap(payment.receiptUrl, regular, 8, right - left)) {
      text(l, left, y, 8, regular, grey);
      y -= 11;
    }
    y -= 8;
  }
  text(`Thank you for choosing ${input.businessName}.`, left, y, 10, regular, grey);

  return Buffer.from(await pdf.save());
}
