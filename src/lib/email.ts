import fs from "fs";
import path from "path";
import { Resend } from "resend";
import { formatTimeLabel } from "@/lib/date-utils";
import {
  buildBookingIcs,
  buildGoogleCalendarAddLink,
  formatTimezoneLabel,
} from "@/lib/ics";

const LOGO_CONTENT_ID = "bubbles-logo";

interface LogoAttachment {
  filename: string;
  content: string;
  contentId: string;
  contentType: string;
}

// Embedded as a CID attachment rather than linked by URL — inline images
// referenced by src="cid:..." render immediately in every mail client
// without needing "show images" permission (unlike a remote <img src>,
// which most clients block by default), and don't depend on whichever
// domain happens to be serving the app when the email is sent. Read once
// and cached — the file never changes at runtime.
let cachedLogo: LogoAttachment | null | undefined;
function getLogoAttachment(): LogoAttachment | null {
  if (cachedLogo === undefined) {
    try {
      const filePath = path.join(process.cwd(), "public", "Bubbles-Logo.png");
      cachedLogo = {
        filename: "Bubbles-Logo.png",
        content: fs.readFileSync(filePath).toString("base64"),
        contentId: LOGO_CONTENT_ID,
        contentType: "image/png",
      };
    } catch (err) {
      console.error("[email] failed to read logo file:", err);
      cachedLogo = null;
    }
  }
  return cachedLogo;
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromAddress(): string | null {
  return process.env.EMAIL_FROM ?? null;
}

/**
 * The real public site — always the same regardless of where the request
 * that triggered the email came from (localhost during dev, the deployed
 * domain in production). Emails are read in an arbitrary inbox, so links
 * and images inside them must never be built from the request's own origin
 * (that's only ever meaningful for redirect URLs within the same request).
 */
function getPublicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Shared visual language for every transactional email — dark header/footer
// with the brand accent, a white rounded content card. Matches the palette
// already used across the app (brand-500 = #f9760f, see globals.css).
const BRAND_DARK = "#0b1220";
const BRAND_ACCENT = "#f9760f";

interface EmailCta {
  heading: string;
  subtext: string;
  buttonText: string;
  href: string;
}

interface EmailLayoutOptions {
  businessName: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  eyebrow: string;
  title: string;
  bodyHtml: string;
  cta?: EmailCta | null;
}

/** Wraps a fragment of body HTML in the branded header/card/footer shell. */
function renderEmailLayout(opts: EmailLayoutOptions): string {
  const ctaSection = opts.cta
    ? `
    <div style="padding:24px 32px;background:${BRAND_DARK};text-align:center;">
      <p style="margin:0 0 4px;color:#ffffff;font-size:14px;font-weight:700;">${opts.cta.heading}</p>
      <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">${opts.cta.subtext}</p>
      <a href="${opts.cta.href}" style="display:inline-block;padding:12px 28px;background:${BRAND_ACCENT};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">
        ${opts.cta.buttonText}
      </a>
    </div>
  `
    : "";

  const addressLine = [opts.businessName, opts.businessAddress].filter(Boolean).join(" · ");

  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="margin:0;padding:0;">
        <div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <div style="background:${BRAND_DARK};padding:24px 32px;text-align:center;">
              <img src="cid:${LOGO_CONTENT_ID}" alt="${opts.businessName}" height="44" style="height:44px;width:auto;" />
            </div>
            <div style="background:${BRAND_DARK};padding:0 32px 24px;">
              <p style="margin:0;color:${BRAND_ACCENT};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-align:center;">${opts.eyebrow}</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:800;text-align:center;">${opts.title}</h1>
            </div>
            <div style="padding:28px 32px;">
              ${opts.bodyHtml}
            </div>
            ${ctaSection}
            <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #eef0f2;text-align:center;">
              ${addressLine ? `<p style="margin:0 0 4px;color:#6b7280;font-size:12px;">${addressLine}${opts.businessPhone ? ` · ${opts.businessPhone}` : ""}</p>` : ""}
              <p style="margin:0;color:#9ca3af;font-size:11px;">Sent automatically by ${opts.businessName}.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function introText(text: string): string {
  return `<p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">${text}</p>`;
}

export interface BookingEmailDetails {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  price: number | null;
  durationMinutes: number;
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  calendarLink: string | null;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPrice(price: number | null): string {
  if (price == null) return "TBC";
  return `$${price.toFixed(2)}`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef0f2;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:110px;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eef0f2;color:#111827;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

function buildBookingDetailsHtml(details: BookingEmailDetails): string {
  const tzLabel = formatTimezoneLabel();
  const rows = [
    ["Booking ID", details.bookingId],
    ["Service", details.serviceName],
    ["Date", formatDate(details.bookingDate)],
    ["Time", `${formatTimeLabel(details.bookingTime)} (${tzLabel})`],
    ["Duration", `${details.durationMinutes} minutes`],
    ["Price", formatPrice(details.price)],
    ["Customer", details.customerName],
    ["Phone", details.customerPhone],
    ["Email", details.customerEmail],
  ];

  const tableRows = rows.map(([label, value]) => detailRow(label, value)).join("");

  const addToCalendarLink = buildGoogleCalendarAddLink({
    summary: `${details.serviceName} — ${details.businessName}`,
    description: `Booking ID: ${details.bookingId}\nCustomer: ${details.customerName}\nPhone: ${details.customerPhone}`,
    location: details.businessAddress,
    startDate: details.bookingDate,
    startTime: details.bookingTime,
    durationMinutes: details.durationMinutes,
  });

  const calendarSection = `
    <div style="margin-top:20px;background:#f9fafb;border:1px solid #eef0f2;border-radius:10px;padding:16px 18px;">
      <p style="margin:0 0 8px;color:#111827;font-size:13px;font-weight:700;">📅 Add to your calendar</p>
      <p style="margin:0 0 12px;color:#4b5563;font-size:13px;line-height:1.6;">
        Appointment time: <strong>${formatTimeLabel(details.bookingTime)} (${tzLabel})</strong><br>
        An <strong>.ics calendar file</strong> is attached — open it to add this booking to your phone or computer calendar.
      </p>
      <p style="margin:0;">
        ${details.calendarLink ? `<a href="${details.calendarLink}" style="color:${BRAND_ACCENT};font-size:13px;font-weight:600;text-decoration:none;">View business calendar</a>&nbsp;&nbsp;` : ""}
        <a href="${addToCalendarLink}" style="display:inline-block;padding:10px 20px;background:${BRAND_ACCENT};color:#ffffff;text-decoration:none;border-radius:999px;font-size:13px;font-weight:600;">Add to Google Calendar</a>
      </p>
    </div>
  `;

  return `
    <table style="width:100%;border-collapse:collapse;">${tableRows}</table>
    ${calendarSection}
  `;
}

function buildIcsAttachment(details: BookingEmailDetails) {
  const ics = buildBookingIcs({
    uid: `${details.bookingId}@bubblescarwash`,
    summary: `${details.serviceName} — ${details.businessName}`,
    description: [
      `Booking ID: ${details.bookingId}`,
      `Customer: ${details.customerName}`,
      `Phone: ${details.customerPhone}`,
      `Email: ${details.customerEmail}`,
      `Service: ${details.serviceName}`,
      `Price: ${details.price != null ? `$${details.price.toFixed(2)}` : "TBC"}`,
    ].join("\n"),
    location: details.businessAddress,
    startDate: details.bookingDate,
    startTime: details.bookingTime,
    durationMinutes: details.durationMinutes,
  });

  return {
    filename: "booking.ics",
    content: Buffer.from(ics).toString("base64"),
  };
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachCalendar = false,
  details?: BookingEmailDetails,
): Promise<boolean> {
  const resend = getResendClient();
  const from = getFromAddress();
  if (!resend || !from) return false;

  try {
    const attachments = [];
    const logo = getLogoAttachment();
    if (logo) attachments.push(logo);
    if (attachCalendar && details) attachments.push(buildIcsAttachment(details));

    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

function bookAgainCta(details: BookingEmailDetails): EmailCta {
  return {
    heading: "Ready for another wash?",
    subtext: "Book your next slot straight from our website.",
    buttonText: `Book On ${details.businessName}`,
    href: `${getPublicSiteUrl()}/book`,
  };
}

export async function sendBookingCreatedEmails(
  details: BookingEmailDetails,
  adminEmail: string,
): Promise<void> {
  const customerHtml = renderEmailLayout({
    businessName: details.businessName,
    businessAddress: details.businessAddress,
    businessPhone: details.businessPhone,
    eyebrow: "Booking Confirmed",
    title: "Your Booking Is Confirmed",
    bodyHtml: `
      ${introText(`Hi ${details.customerName}, your booking at <strong>${details.businessName}</strong> has been confirmed.`)}
      ${buildBookingDetailsHtml(details)}
      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Payment is collected at the time of service.</p>
    `,
    cta: bookAgainCta(details),
  });

  const adminHtml = renderEmailLayout({
    businessName: details.businessName,
    businessAddress: details.businessAddress,
    businessPhone: details.businessPhone,
    eyebrow: "New Booking",
    title: "A New Booking Just Came In",
    bodyHtml: `
      ${introText("A new booking has been created — details below.")}
      ${buildBookingDetailsHtml(details)}
    `,
  });

  await Promise.all([
    sendEmail(
      details.customerEmail,
      `Booking Confirmed — ${details.businessName}`,
      customerHtml,
      true,
      details,
    ),
    sendEmail(
      adminEmail,
      `New Booking: ${details.customerName} — ${formatDate(details.bookingDate)}`,
      adminHtml,
      true,
      details,
    ),
  ]);
}

export async function sendBookingRescheduledEmails(
  details: BookingEmailDetails,
  adminEmail: string,
): Promise<void> {
  const customerHtml = renderEmailLayout({
    businessName: details.businessName,
    businessAddress: details.businessAddress,
    businessPhone: details.businessPhone,
    eyebrow: "Booking Updated",
    title: "Your Booking Was Rescheduled",
    bodyHtml: `
      ${introText(`Hi ${details.customerName}, your booking at <strong>${details.businessName}</strong> has been rescheduled to the new date and time below.`)}
      ${buildBookingDetailsHtml(details)}
    `,
    cta: bookAgainCta(details),
  });

  const adminHtml = renderEmailLayout({
    businessName: details.businessName,
    businessAddress: details.businessAddress,
    businessPhone: details.businessPhone,
    eyebrow: "Booking Updated",
    title: "A Booking Was Rescheduled",
    bodyHtml: `
      ${introText("A booking has been rescheduled — details below.")}
      ${buildBookingDetailsHtml(details)}
    `,
  });

  await Promise.all([
    sendEmail(
      details.customerEmail,
      `Booking Rescheduled — ${details.businessName}`,
      customerHtml,
      true,
      details,
    ),
    sendEmail(
      adminEmail,
      `Booking Rescheduled: ${details.customerName}`,
      adminHtml,
      true,
      details,
    ),
  ]);
}

export async function sendBookingCancelledEmails(
  details: BookingEmailDetails,
  adminEmail: string,
): Promise<void> {
  const customerHtml = renderEmailLayout({
    businessName: details.businessName,
    businessAddress: details.businessAddress,
    businessPhone: details.businessPhone,
    eyebrow: "Booking Cancelled",
    title: "Your Booking Was Cancelled",
    bodyHtml: `
      ${introText(`Hi ${details.customerName}, your booking at <strong>${details.businessName}</strong> has been cancelled.`)}
      ${buildBookingDetailsHtml(details)}
    `,
    cta: bookAgainCta(details),
  });

  const adminHtml = renderEmailLayout({
    businessName: details.businessName,
    businessAddress: details.businessAddress,
    businessPhone: details.businessPhone,
    eyebrow: "Booking Cancelled",
    title: "A Booking Was Cancelled",
    bodyHtml: `
      ${introText("A booking has been cancelled — details below.")}
      ${buildBookingDetailsHtml(details)}
    `,
  });

  await Promise.all([
    sendEmail(
      details.customerEmail,
      `Booking Cancelled — ${details.businessName}`,
      customerHtml,
    ),
    sendEmail(
      adminEmail,
      `Booking Cancelled: ${details.customerName}`,
      adminHtml,
    ),
  ]);
}

export interface GiftCardEmailDetails {
  code: string;
  value: number;
  productName: string;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string | null;
  recipientEmail: string | null;
  message: string | null;
  expiresAt: string;
  businessName: string;
}

function formatGiftCardExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sendGiftCardEmail(details: GiftCardEmailDetails): Promise<void> {
  const expiresLabel = formatGiftCardExpiry(details.expiresAt);
  const hasDistinctRecipient = Boolean(
    details.recipientEmail && details.recipientEmail !== details.purchaserEmail,
  );

  const recipientHtml = renderEmailLayout({
    businessName: details.businessName,
    eyebrow: "Gift Card",
    title: "You've Received A Gift Card!",
    bodyHtml: `
      ${introText(`Hi ${details.recipientName || "there"}, ${details.purchaserName} sent you a <strong>${details.productName}</strong> gift card for <strong>${details.businessName}</strong>.`)}
      ${
        details.message
          ? `<div style="margin:0 0 20px;padding:16px 18px;background:#f9fafb;border:1px solid #eef0f2;border-radius:10px;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap;">${details.message}</div>`
          : ""
      }
      <div style="margin:0 0 20px;padding:20px;background:#f9fafb;border:1px dashed ${BRAND_ACCENT};border-radius:10px;text-align:center;">
        <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#9ca3af;">Your gift card code</p>
        <p style="margin:6px 0;font-size:26px;font-weight:800;letter-spacing:3px;color:#111827;">${details.code}</p>
        <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND_ACCENT};">Value: $${details.value.toFixed(2)}</p>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px;">Valid until <strong>${expiresLabel}</strong>. Enter this code when booking online, or mention it in person.</p>
    `,
    cta: {
      heading: "Ready to use it?",
      subtext: "Book a wash straight from our website.",
      buttonText: `Book On ${details.businessName}`,
      href: `${getPublicSiteUrl()}/book`,
    },
  });

  const tasks = [
    sendEmail(
      details.recipientEmail || details.purchaserEmail,
      `You've received a $${details.value.toFixed(2)} gift card — ${details.businessName}`,
      recipientHtml,
    ),
  ];

  if (hasDistinctRecipient) {
    const receiptHtml = renderEmailLayout({
      businessName: details.businessName,
      eyebrow: "Receipt",
      title: "Your Gift Card Purchase",
      bodyHtml: `
        ${introText(`Hi ${details.purchaserName}, thanks for your purchase! Your <strong>${details.productName}</strong> gift card (code <strong>${details.code}</strong>, value $${details.value.toFixed(2)}) has been sent to ${details.recipientName || details.recipientEmail}.`)}
        <p style="margin:0;color:#9ca3af;font-size:12px;">Valid until ${expiresLabel}.</p>
      `,
    });
    tasks.push(
      sendEmail(
        details.purchaserEmail,
        `Receipt: Gift Card for ${details.recipientName || "your recipient"} — ${details.businessName}`,
        receiptHtml,
      ),
    );
  }

  await Promise.all(tasks);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
