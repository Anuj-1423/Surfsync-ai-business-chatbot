import { NextResponse } from "next/server";
import { saveLead } from "@/lib/leads";
import { sendLeadNotification } from "@/lib/lead-notification";
import { isRateLimited } from "@/lib/rate-limit";
import { leadRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (isRateLimited(`lead:${forwardedFor}`)) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = leadRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.reduce<Record<string, string>>((result, issue) => {
      const field = issue.path[0];
      if (typeof field === "string" && !result[field]) result[field] = issue.message;
      return result;
    }, {});
    return NextResponse.json({ error: "Please review the highlighted fields.", fields }, { status: 400 });
  }

  try {
    const saved = await saveLead(parsed.data);
    let emailSent = false;
    try {
      emailSent = await sendLeadNotification(parsed.data, saved.id);
    } catch {
      console.error("Lead email notification failed.");
    }
    return NextResponse.json({ success: true, reference: saved.id, duplicate: saved.duplicate, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Lead persistence failed:", error instanceof Error ? error.message : "Unknown storage error");
    return NextResponse.json(
      { error: "We couldn't save your enquiry just now. Your details haven't been submitted; please try again." },
      { status: 503 }
    );
  }
}
