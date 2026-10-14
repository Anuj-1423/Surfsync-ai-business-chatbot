import "server-only";
import nodemailer from "nodemailer";
import type { LeadInput } from "@/lib/validation";

const recipient = process.env.LEAD_NOTIFICATION_EMAIL || "anujsingh41086@gmail.com";
const emailFrom = process.env.LEAD_EMAIL_FROM || "SurfSync Enquiries <info@surfsyncinfotech.in>";

export function isLeadEmailConfigured() {
  return Boolean((process.env.RESEND_API_KEY || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)) && recipient);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]!);
}

export async function sendLeadNotification(lead: LeadInput, reference: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const sender = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  const details = [
    ["Reference", reference],
    ["Name", lead.name],
    ["Email", lead.email],
    ["Phone", lead.phone || "Not provided"],
    ["Service", lead.service],
    ["Budget", lead.budget || "Not provided"],
    ["Timeline", lead.timeline || "Not provided"]
  ] as const;
  const htmlRows = details.map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  const text = [
    `New SurfSync enquiry (${reference})`,
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    "Project details:",
    lead.description
  ].join("\n");
  const html = `<h2>New SurfSync enquiry</h2><table cellpadding="6">${htmlRows}</table><h3>Project details</h3><p>${escapeHtml(lead.description).replace(/\n/g, "<br>")}</p>`;
  const subject = `New SurfSync enquiry: ${lead.service} — ${lead.name}`;

  // Render Free blocks SMTP ports; use an HTTPS email API when configured.
  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `lead-${reference}`
      },
      body: JSON.stringify({ from: emailFrom, to: [recipient], reply_to: lead.email, subject, text, html }),
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) {
      console.error("Lead email API rejected the request:", response.status);
      return false;
    }
    return true;
  }

  if (!sender || !appPassword) return false;
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: sender, pass: appPassword } });
  await transporter.sendMail({ from: `SurfSync Enquiries <${sender}>`, to: recipient, replyTo: lead.email, subject, text, html });
  return true;
}
