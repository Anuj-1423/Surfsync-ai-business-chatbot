import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { generateAnswer } from "@/lib/openai";
import { isRateLimited } from "@/lib/rate-limit";
import { getAdmin, getCustomer } from "@/lib/live-chat";
import { isSupabaseConfigured } from "@/lib/supabase";
import { chatRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Sign-in and saved chat history require Supabase configuration." }, { status: 503 });
  }
  const forwardedFor = request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (isRateLimited(`chat:${forwardedFor}`)) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check your message." }, { status: 400 });
  }

  try {
    const customer = await getCustomer(request);
    if (!customer) return NextResponse.json({ error: "Please sign in with a customer account before chatting." }, { status: 401 });
    const messages = [...parsed.data.history, { role: "user" as const, content: parsed.data.message }].slice(-10);
    const result = await generateAnswer(messages);
    const { error: historyError } = await getAdmin().from("customer_queries").insert({
      customer_id: customer.userId,
      conversation_id: parsed.data.conversationId ?? randomUUID(),
      question: parsed.data.message,
      answer: result.answer
    });
    return NextResponse.json({ answer: result.answer, status: result.status, historySaved: !historyError });
  } catch {
    return NextResponse.json(
      { error: "I couldn't respond just now. Please try again, or contact info@surfsyncinfotech.in." },
      { status: 503 }
    );
  }
}
