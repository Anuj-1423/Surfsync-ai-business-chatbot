import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured: isSupabaseConfigured()
  });
}
