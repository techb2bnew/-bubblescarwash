import { Resend } from "resend";
import { formatTimeLabel } from "@/lib/date-utils";
import {
  buildBookingIcs,
  buildGoogleCalendarAddLink,
  formatTimezoneLabel,
} from "@/lib/ics";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromAddress(): string | null {
  return process.env.EMAIL_FROM ?? null;
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

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;width:120px;">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500;">${value}</td></tr>`,
    )
    .join("");

  const addToCalendarLink = buildGoogleCalendarAddLink({
    summary: `${details.serviceName} — ${details.businessName}`,
    description: `Booking ID: ${details.bookingId}\nCustomer: ${details.customerName}\nPhone: ${details.customerPhone}`,
    location: details.businessAddress,
    startDate: details.bookingDate,
    startTime: details.bookingTime,
    durationMinutes: details.durationMinutes,
  });

  const calendarSection = `
    <div style="margin-top:20px;padding:16px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
      <p style="margin:0 0 12px;font-weight:600;color:#0369a1;">📅 Add to your calendar</p>
      <p style="margin:0 0 12px;color:#555;font-size:14px;">
        Appointment time: <strong>${formatTimeLabel(details.bookingTime)} (${tzLabel})</strong><br>
        An <strong>.ics calendar file</strong> is attached — open it to add this booking to your phone or computer calendar.
      </p>
      <p style="margin:0;">
        <a href="${addToCalendarLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Add to Google Calendar</a>
        ${details.calendarLink ? `&nbsp;<a href="${details.calendarLink}" style="color:#2563eb;font-size:14px;">View business calendar</a>` : ""}
      </p>
    </div>
  `;

  const addressSection = details.businessAddress
    ? `<p style="color:#666;margin-top:16px;">${details.businessName}<br>${details.businessAddress}${details.businessPhone ? `<br>${details.businessPhone}` : ""}</p>`
    : "";

  return `
    <table style="border-collapse:collapse;width:100%;max-width:500px;">${tableRows}</table>
    ${calendarSection}
    ${addressSection}
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
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      attachments:
        attachCalendar && details
          ? [buildIcsAttachment(details)]
          : undefined,
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

export async function sendBookingCreatedEmails(
  details: BookingEmailDetails,
  adminEmail: string,
): Promise<void> {
  const customerHtml = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h2 style="color:#111;">Booking Confirmed</h2>
      <p>Hi ${details.customerName},</p>
      <p>Your booking at <strong>${details.businessName}</strong> has been confirmed.</p>
      ${buildBookingDetailsHtml(details)}
      <p style="margin-top:24px;color:#666;font-size:14px;">Payment is collected at the time of service.</p>
    </div>
  `;

  const adminHtml = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h2 style="color:#111;">New Booking</h2>
      <p>A new booking has been created.</p>
      ${buildBookingDetailsHtml(details)}
    </div>
  `;

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
  const customerHtml = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h2 style="color:#111;">Booking Rescheduled</h2>
      <p>Hi ${details.customerName},</p>
      <p>Your booking at <strong>${details.businessName}</strong> has been rescheduled to the new date and time below.</p>
      ${buildBookingDetailsHtml(details)}
    </div>
  `;

  const adminHtml = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h2 style="color:#111;">Booking Rescheduled</h2>
      <p>A booking has been rescheduled.</p>
      ${buildBookingDetailsHtml(details)}
    </div>
  `;

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
  const customerHtml = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h2 style="color:#111;">Booking Cancelled</h2>
      <p>Hi ${details.customerName},</p>
      <p>Your booking at <strong>${details.businessName}</strong> has been cancelled.</p>
      ${buildBookingDetailsHtml(details)}
      <p style="margin-top:24px;">If you'd like to book again, please visit our website.</p>
    </div>
  `;

  const adminHtml = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h2 style="color:#111;">Booking Cancelled</h2>
      <p>A booking has been cancelled.</p>
      ${buildBookingDetailsHtml(details)}
    </div>
  `;

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

  const recipientHtml = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h2 style="color:#111;">You've received a Gift Card!</h2>
      <p>Hi ${details.recipientName || "there"},</p>
      <p>${details.purchaserName} sent you a <strong>${details.productName}</strong> gift card for <strong>${details.businessName}</strong>.</p>
      ${details.message ? `<blockquote style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-left:3px solid #ddd;color:#444;">${details.message}</blockquote>` : ""}
      <div style="margin:20px 0;padding:20px;background:#f0f9ff;border:1px dashed #7dd3fc;border-radius:8px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#0369a1;">Your gift card code</p>
        <p style="margin:4px 0;font-size:24px;font-weight:700;letter-spacing:2px;color:#0c4a6e;">${details.code}</p>
        <p style="margin:0;font-size:14px;color:#0369a1;">Value: $${details.value.toFixed(2)}</p>
      </div>
      <p style="color:#666;font-size:14px;">Valid until <strong>${expiresLabel}</strong>. Enter this code when booking online, or mention it in person.</p>
    </div>
  `;

  const tasks = [
    sendEmail(
      details.recipientEmail || details.purchaserEmail,
      `You've received a $${details.value.toFixed(2)} gift card — ${details.businessName}`,
      recipientHtml,
    ),
  ];

  if (hasDistinctRecipient) {
    const receiptHtml = `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#111;">Gift Card Purchase Receipt</h2>
        <p>Hi ${details.purchaserName},</p>
        <p>Thanks for your purchase! Your <strong>${details.productName}</strong> gift card (code <strong>${details.code}</strong>, value $${details.value.toFixed(2)}) has been sent to ${details.recipientName || details.recipientEmail}.</p>
        <p style="color:#666;font-size:14px;">Valid until ${expiresLabel}.</p>
      </div>
    `;
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

export interface ContactEnquiryDetails {
  name: string;
  phone: string;
  email: string;
  service: string | null;
  message: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactEnquiryEmail(
  details: ContactEnquiryDetails,
  toEmail: string,
  siteUrl: string,
): Promise<boolean> {
  const name = escapeHtml(details.name);
  const phone = escapeHtml(details.phone);
  const email = escapeHtml(details.email);
  const service = details.service ? escapeHtml(details.service) : null;
  const message = escapeHtml(details.message);
  siteUrl = siteUrl.replace(/\/$/, "");
  const logoUrl = "https://bubblescarwashcafe.com.au/wp-content/uploads/2019/09/Bubbles-Logo.png";
  const bookUrl = `${siteUrl}/book`;

  const socialIcon = (href: string, label: string, path: string) => `
    <a href="${href}" style="display:inline-block;width:32px;height:32px;margin:0 4px;border-radius:999px;background:#1a2436;text-align:center;line-height:32px;" aria-label="${label}">
      <img src="${path}" width="14" height="14" alt="${label}" style="vertical-align:middle;" />
    </a>
  `;

  const html = `
    <div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <div style="background:#0b1220;padding:24px 32px;text-align:center;">
          <img src="${logoUrl}" alt="Bubbles Car Wash & Cafe" height="44" style="height:44px;width:auto;" />
        </div>
        <div style="background:#0b1220;padding:0 32px 24px;">
          <p style="margin:0;color:#f9760f;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-align:center;">New Enquiry</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:800;text-align:center;">Someone Reached Out On The Website</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">
            Someone just submitted the contact form on the website. Their details are below.
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eef0f2;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:110px;vertical-align:top;">Name</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef0f2;color:#111827;font-size:14px;font-weight:600;">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eef0f2;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Phone</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef0f2;font-size:14px;"><a href="tel:${phone}" style="color:#f9760f;text-decoration:none;font-weight:600;">${phone}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #eef0f2;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef0f2;font-size:14px;"><a href="mailto:${email}" style="color:#f9760f;text-decoration:none;font-weight:600;">${email}</a></td>
            </tr>
            ${
              service
                ? `<tr>
              <td style="padding:10px 0;border-bottom:1px solid #eef0f2;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Regarding</td>
              <td style="padding:10px 0;border-bottom:1px solid #eef0f2;color:#111827;font-size:14px;font-weight:600;">${service}</td>
            </tr>`
                : ""
            }
          </table>
          <p style="margin:24px 0 8px;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
          <div style="background:#f9fafb;border:1px solid #eef0f2;border-radius:10px;padding:16px 18px;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap;">${message}</div>
          <a href="mailto:${email}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#f9760f;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;">
            Reply to ${name.split(" ")[0]}
          </a>
        </div>
        <div style="padding:24px 32px;background:#0b1220;text-align:center;">
          <p style="margin:0 0 4px;color:#ffffff;font-size:14px;font-weight:700;">Got a customer waiting on a wash?</p>
          <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">Book their slot for them straight from the admin, or send them this link.</p>
          <a href="${bookUrl}" style="display:inline-block;padding:12px 28px;background:#f9760f;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">
            Book On Bubbles Car Wash
          </a>
        </div>
        <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #eef0f2;text-align:center;">
          <div style="margin-bottom:12px;">
            ${socialIcon("https://facebook.com", "Facebook", "https://cdn-icons-png.flaticon.com/32/733/733547.png")}
            ${socialIcon("https://instagram.com", "Instagram", "https://cdn-icons-png.flaticon.com/32/2111/2111463.png")}
          </div>
          <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">Bubbles Car Wash &amp; Cafe · 273 North East Rd, Hampstead Gardens SA 5086</p>
          <p style="margin:0;color:#9ca3af;font-size:11px;">Sent automatically from the contact form at bubblescarwashcafe.com.au</p>
        </div>
      </div>
    </div>
  `;

  return sendEmail(toEmail, `New Website Enquiry from ${details.name}`, html);
}
