import "server-only";
import nodemailer from "nodemailer";
import type { LeadInput } from "@/lib/validation";

const recipient = process.env.LEAD_NOTIFICATION_EMAIL || "anujsingh41086@gmail.com";

export function isLeadEmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && recipient);
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
  const sender = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!sender || !appPassword) return false;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: sender, pass: appPassword }
  });
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

  await transporter.sendMail({
    from: `SurfSync Enquiries <${sender}>`,
    to: recipient,
    replyTo: lead.email,
    subject: `New SurfSync enquiry: ${lead.service} — ${lead.name}`,
    text,
    html: `<h2>New SurfSync enquiry</h2><table cellpadding="6">${htmlRows}</table><h3>Project details</h3><p>${escapeHtml(lead.description).replace(/\n/g, "<br>")}</p>`
  });
  return true;
}
