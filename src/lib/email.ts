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

export async function sendContactEnquiryEmail(
  details: ContactEnquiryDetails,
  toEmail: string,
): Promise<boolean> {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h2 style="color:#111;">New Website Enquiry</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;width:120px;">Name</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500;">${details.name}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500;">${details.phone}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500;">${details.email}</td></tr>
        ${details.service ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">Regarding</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:500;">${details.service}</td></tr>` : ""}
      </table>
      <p style="margin-top:20px;color:#666;font-size:13px;">Message</p>
      <p style="white-space:pre-wrap;">${details.message}</p>
    </div>
  `;

  return sendEmail(toEmail, `Website Enquiry from ${details.name}`, html);
}
