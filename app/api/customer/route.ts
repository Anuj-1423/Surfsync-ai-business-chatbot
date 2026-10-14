import { NextResponse } from "next/server";
import { getAdmin, getAuthenticatedUser } from "@/lib/live-chat";
import { isSupabaseConfigured } from "@/lib/supabase";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Customer accounts aren't configured yet." }, { status: 503 });
  }
  try {
    const admin = getAdmin();
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    const { data: agent, error: agentError } = await admin.from("team_agents").select("user_id").eq("user_id", user.id).maybeSingle();
    if (agentError) throw agentError;
    if (agent) return NextResponse.json({ error: "This is a team account. Use the team sign-in panel." }, { status: 403 });

    const { data: existing, error: profileError } = await admin.from("customer_profiles").select("user_id, full_name").eq("user_id", user.id).maybeSingle();
    if (profileError) throw profileError;
    const metadataName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    const candidate = existing?.full_name ?? metadataName.slice(0, 100);
    const emailName = user.email?.split("@")[0] ?? "";
    const safeName = candidate.length >= 2 ? candidate : emailName.length >= 2 ? emailName : "Customer";
    if (!existing) {
      const { error } = await admin.from("customer_profiles").insert({ user_id: user.id, full_name: safeName });
      if (error) throw error;
    }
    const requestedConversationId = new URL(request.url).searchParams.get("conversationId");
    const validRequestedConversation = requestedConversationId && z.uuid().safeParse(requestedConversationId).success ? requestedConversationId : null;
    let conversationId = validRequestedConversation;
    if (!conversationId) {
      const { data: latest, error } = await admin.from("customer_queries").select("conversation_id").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      conversationId = latest?.conversation_id ?? null;
    }
    let history: { role: "user" | "assistant"; content: string }[] = [];
    if (conversationId) {
      const { data: queries, error } = await admin.from("customer_queries").select("question, answer").eq("customer_id", user.id).eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100);
      if (error) throw error;
      history = (queries ?? []).flatMap((query) => [
        { role: "user" as const, content: query.question },
        { role: "assistant" as const, content: query.answer }
      ]);
    }
    return NextResponse.json({ user: { id: user.id, name: safeName, email: user.email ?? "" }, conversationId, history });
  } catch {
    return NextResponse.json({ error: "We couldn't load your account. Please try again." }, { status: 503 });
  }
}
