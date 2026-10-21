import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatTimeLabel } from "@/lib/date-utils";
import { getBusinessTimezone } from "@/lib/google-calendar";

/**
 * Seller details printed on every tax invoice. The business-settings table
 * still holds placeholder values, and an invoice is a legal document, so these
 * are fixed here (override any of them with the matching INVOICE_* env var).
 */
export function getInvoiceBusiness() {
  return {
    name: process.env.INVOICE_BUSINESS_NAME || "Bubbles Car Wash & Cafe",
    addressLines: (process.env.INVOICE_ADDRESS || "273 North East Rd|Hampstead Gardens SA 5086").split("|"),
    phone: process.env.INVOICE_PHONE || "(08) 7080 5959",
    abn: process.env.INVOICE_ABN || "38 667 587 411",
  };
}

/** What get_booking_invoice() returns (see migration 0069). */
export interface InvoiceRow {
  booking_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  car_number: string | null;
  booking_date: string;
  booking_time: string;
  booking_type: string | null;
  vehicle_name: string | null;
  service_name: string | null;
  price: number | string | null;
  discount_amount: number | string;
  gift_card_discount: number | string;
  card_brand: string | null;
  card_last4: string | null;
  receipt_url: string | null;
  stripe_payment_intent_id?: string | null;
  extras: { name: string; price: number | string }[];
}

/** How the customer paid, as reported by Stripe. */
export interface PaymentMethodInfo {
  type: string | null; // "card", "link", ...
  wallet: string | null; // "apple_pay", "google_pay", ...
}

export interface InvoiceLine {
  description: string;
  amount: number;
}

export interface TaxInvoice {
  invoiceNumber: string;
  issuedOn: string;
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  carNumber: string | null;
  serviceName: string;
  vehicleName: string | null;
  bookingTypeLabel: string;
  dateLabel: string;
  timeLabel: string;
  lines: InvoiceLine[];
  total: number;
  gst: number;
  paymentMethod: string;
  cardBrand: string | null;
  cardLast4: string | null;
  /** "Apple Pay", "Google Pay", "Link" or "Card" — drives the badge in the email. */
  methodLabel: string;
  receiptUrl: string | null;
}

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildTaxInvoice(
  row: InvoiceRow,
  now = new Date(),
  method: PaymentMethodInfo = { type: null, wallet: null },
): TaxInvoice {
  const tz = getBusinessTimezone();
  const total = num(row.price);
  const discount = num(row.discount_amount);
  const giftCard = num(row.gift_card_discount);
  const extras = (row.extras ?? []).map((e) => ({ name: e.name, price: num(e.price) }));
  const extrasTotal = extras.reduce((sum, e) => sum + e.price, 0);

  // total = service - discount + add-ons - gift card, so the service line is
  // whatever is left once the other parts are taken back out.
  const servicePrice = Math.round((total + discount + giftCard - extrasTotal) * 100) / 100;
  const serviceName = row.service_name ?? "Car wash";

  const lines: InvoiceLine[] = [{ description: serviceName, amount: servicePrice }];
  if (discount > 0) lines.push({ description: "Discount", amount: -discount });
  for (const e of extras) lines.push({ description: `Add-on: ${e.name}`, amount: e.price });
  if (giftCard > 0) lines.push({ description: "Gift card applied", amount: -giftCard });

  const brand = row.card_brand ? titleCase(row.card_brand) : null;
  const cardText = row.card_last4 ? `${brand ?? "Card"} ending ${row.card_last4}` : null;
  const methodLabel =
    method.wallet === "apple_pay"
      ? "Apple Pay"
      : method.wallet === "google_pay"
        ? "Google Pay"
        : method.type === "link"
          ? "Link"
          : "Card";
  const paymentMethod =
    methodLabel === "Card"
      ? (cardText ?? "Online payment (Stripe)")
      : cardText
        ? `${methodLabel} (${cardText})`
        : methodLabel;

  return {
    invoiceNumber: `INV-${row.booking_id.slice(0, 8).toUpperCase()}`,
    issuedOn: now.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: tz }),
    bookingId: row.booking_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    carNumber: row.car_number,
    serviceName,
    vehicleName: row.vehicle_name,
    bookingTypeLabel: row.booking_type === "offline" ? "In-store booking" : "Online booking",
    dateLabel: longDate(row.booking_date),
    timeLabel: formatTimeLabel(row.booking_time.slice(0, 5)),
    lines,
    total,
    // Prices include GST, so GST is one eleventh of the total.
    gst: Math.round((total / 11) * 100) / 100,
    paymentMethod,
    cardBrand: brand,
    cardLast4: row.card_last4,
    methodLabel,
    receiptUrl: row.receipt_url,
  };
}

export { money as formatInvoiceMoney };

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** pdf-lib's built-in fonts only cover Latin-1; swap anything else for "?". */
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const ACCENT = rgb(0.91, 0.35, 0.05);
const RULE = rgb(0.88, 0.9, 0.92);

/** pdf-lib has no rounded rectangles, so draw one as an SVG path (origin top-left, y down). */
function roundedRect(page: PDFPage, x: number, y: number, w: number, h: number, r: number, color: ReturnType<typeof rgb>) {
  const d = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(d, { x, y: y + h, color, borderWidth: 0 });
}

export async function renderTaxInvoicePdf(inv: TaxInvoice): Promise<Buffer> {
  const biz = getInvoiceBusiness();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tax Invoice ${inv.invoiceNumber}`);
  pdf.setAuthor(biz.name);
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const left = 48;
  const right = 595.28 - 48;

  const text = (p: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = INK) =>
    p.drawText(safe(s), { x, y, size, font, color });
  const textRight = (s: string, xRight: number, y: number, size: number, font: PDFFont, color = INK) =>
    text(page, s, xRight - font.widthOfTextAtSize(safe(s), size), y, size, font, color);
  const rule = (y: number, color = RULE, thickness = 0.8) =>
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness, color });

  // Header: seller on the left, invoice meta on the right.
  let y = 790;
  text(page, biz.name, left, y, 17, bold);
  y -= 16;
  for (const line of biz.addressLines) {
    text(page, line, left, y, 9.5, regular, MUTED);
    y -= 13;
  }
  text(page, `Phone: ${biz.phone}`, left, y, 9.5, regular, MUTED);
  y -= 13;
  text(page, `ABN: ${biz.abn}`, left, y, 9.5, bold);

  textRight("TAX INVOICE", right, 790, 22, bold, ACCENT);
  textRight(`Invoice no: ${inv.invoiceNumber}`, right, 768, 10, regular);
  textRight(`Date: ${inv.issuedOn}`, right, 754, 10, regular);
  textRight("Status: PAID", right, 740, 10, bold);

  y = 700;
  rule(y, ACCENT, 1.5);

  // Billed to + booking details, side by side.
  y -= 24;
  const colB = 320;
  text(page, "BILLED TO", left, y, 8.5, bold, MUTED);
  text(page, "BOOKING DETAILS", colB, y, 8.5, bold, MUTED);

  let yl = y - 18;
  text(page, inv.customerName, left, yl, 11, bold);
  yl -= 15;
  text(page, inv.customerEmail, left, yl, 9.5, regular, MUTED);
  yl -= 13;
  text(page, inv.customerPhone, left, yl, 9.5, regular, MUTED);

  const details: [string, string][] = [
    ["Service", inv.serviceName],
    ["Date", inv.dateLabel],
    ["Time", inv.timeLabel],
    ["Booking type", inv.bookingTypeLabel],
    ...(inv.vehicleName ? ([["Vehicle", inv.vehicleName]] as [string, string][]) : []),
    ...(inv.carNumber ? ([["Car plate", inv.carNumber]] as [string, string][]) : []),
  ];
  let yr = y - 18;
  for (const [label, value] of details) {
    text(page, label, colB, yr, 9.5, regular, MUTED);
    text(page, value, colB + 78, yr, 9.5, bold);
    yr -= 15;
  }

  // Line items.
  y = Math.min(yl, yr) - 22;
  page.drawRectangle({ x: left, y: y - 6, width: right - left, height: 22, color: rgb(0.96, 0.97, 0.98) });
  text(page, "DESCRIPTION", left + 8, y, 8.5, bold, MUTED);
  textRight("AMOUNT (INC. GST)", right - 8, y, 8.5, bold, MUTED);
  y -= 24;
  for (const line of inv.lines) {
    text(page, line.description, left + 8, y, 10.5, regular);
    textRight(money(line.amount), right - 8, y, 10.5, regular, line.amount < 0 ? ACCENT : INK);
    y -= 8;
    rule(y);
    y -= 16;
  }

  // Totals.
  y -= 2;
  text(page, "Total paid", left + 8, y, 12, bold);
  textRight(money(inv.total), right - 8, y, 14, bold);
  y -= 18;
  text(page, "Total includes GST of", left + 8, y, 9.5, regular, MUTED);
  textRight(money(inv.gst), right - 8, y, 9.5, regular, MUTED);
  y -= 30;

  // Payment.
  rule(y);
  y -= 22;
  text(page, "PAYMENT", left, y, 8.5, bold, MUTED);
  y -= 17;
  text(page, "Paid by", left, y, 9.5, regular, MUTED);
  text(page, inv.paymentMethod, left + 78, y, 9.5, bold);
  y -= 15;
  text(page, "Booking ID", left, y, 9.5, regular, MUTED);
  text(page, inv.bookingId, left + 78, y, 9, regular);
  if (inv.receiptUrl) {
    // Receipt "document": a page with a folded corner, clickable.
    y -= 30;
    const boxW = 300;
    const boxH = 104;
    const bx = left;
    const by = y - boxH;
    const fold = 18;
    const edge = rgb(0.72, 0.75, 0.8);
    page.drawRectangle({ x: bx + 3, y: by - 3, width: boxW, height: boxH, color: rgb(0.9, 0.91, 0.93) }); // shadow
    page.drawRectangle({ x: bx, y: by, width: boxW, height: boxH, color: rgb(1, 1, 1), borderColor: edge, borderWidth: 1 });
    // folded top-right corner
    page.drawRectangle({ x: bx + boxW - fold - 1, y: by + boxH - fold - 1, width: fold + 2, height: fold + 2, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: bx + boxW - fold, y: by + boxH }, end: { x: bx + boxW - fold, y: by + boxH - fold }, thickness: 1, color: edge });
    page.drawLine({ start: { x: bx + boxW - fold, y: by + boxH - fold }, end: { x: bx + boxW, y: by + boxH - fold }, thickness: 1, color: edge });
    page.drawLine({ start: { x: bx + boxW - fold, y: by + boxH }, end: { x: bx + boxW, y: by + boxH - fold }, thickness: 1, color: edge });
    page.drawRectangle({ x: bx, y: by + boxH - 4, width: boxW - fold, height: 4, color: ACCENT });

    text(page, "PAYMENT RECEIPT", bx + 14, by + boxH - 24, 11, bold);
    text(page, `Amount paid ${money(inv.total)}  |  ${inv.paymentMethod}`, bx + 14, by + boxH - 40, 8.5, regular, MUTED);
    page.drawLine({
      start: { x: bx + 14, y: by + 44 },
      end: { x: bx + boxW - 14, y: by + 44 },
      thickness: 0.8,
      color: RULE,
      dashArray: [3, 3],
    });
    // the click-me bar
    roundedRect(page, bx + 14, by + 12, boxW - 28, 24, 12, ACCENT);
    const cta = "For receipt, click me";
    const ctaW = bold.widthOfTextAtSize(cta, 10.5);
    text(page, cta, bx + (boxW - ctaW) / 2, by + 20, 10.5, bold, rgb(1, 1, 1));
    const link = pdf.context.register(
      pdf.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [bx + 14, by + 12, bx + boxW - 14, by + 36],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(inv.receiptUrl) },
      }),
    );
    page.node.addAnnot(link);
  }

  text(page, "Thank you for choosing Bubbles Car Wash & Cafe.", left, 56, 9.5, regular, MUTED);
  textRight(`${biz.name}  |  ABN ${biz.abn}`, right, 56, 8.5, regular, MUTED);

  return Buffer.from(await pdf.save());
}
