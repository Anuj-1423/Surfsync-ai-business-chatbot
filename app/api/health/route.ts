import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isLeadEmailConfigured } from "@/lib/lead-notification";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured: isSupabaseConfigured(),
    leadEmailConfigured: isLeadEmailConfigured()
  });
}
