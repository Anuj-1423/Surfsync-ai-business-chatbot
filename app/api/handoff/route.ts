import { NextResponse } from "next/server";
import { asMessage, getAdmin, getCustomer, getTeamAgent, hashVisitorToken, isValidVisitorToken } from "@/lib/live-chat";
import { isRateLimited } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

function unavailable() {
  return NextResponse.json({ error: "Live chat isn't configured yet. Please start a guided project enquiry or email info@surfsyncinfotech.in." }, { status: 503 });
}

async function loadMessages(admin: ReturnType<typeof getAdmin>, chatId: string) {
  const { data, error } = await admin.from("live_chat_messages")
    .select("id, sender_role, sender_name, body, created_at")
    .eq("chat_id", chatId).order("created_at", { ascending: true }).limit(1000);
  if (error) throw error;
  return data ?? [];
}

async function loadCustomerHistories(admin: ReturnType<typeof getAdmin>) {
  const rows: { id: number; customer_id: string; conversation_id: string; question: string; answer: string; created_at: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("customer_queries").select("id, customer_id, conversation_id, question, answer, created_at")
      .order("created_at", { ascending: true }).range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const profiles: { user_id: string; full_name: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("customer_profiles").select("user_id, full_name").order("created_at", { ascending: false }).range(offset, offset + 499);
    if (error) throw error;
    profiles.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  const byCustomer = new Map<string, typeof rows>();
  for (const row of rows) {
    const customerRows = byCustomer.get(row.customer_id) ?? [];
    customerRows.push(row);
    byCustomer.set(row.customer_id, customerRows);
  }
  return profiles.map((profile) => ({ userId: profile.user_id, name: profile.full_name, queries: byCustomer.get(profile.user_id) ?? [] }));
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return unavailable();
  try {
    const admin = getAdmin();
    const agent = await getTeamAgent(request);
    if (agent) {
      const now = new Date().toISOString();
      const [{ data: waiting, error: waitingError }, { data: assigned, error: assignedError }, { data: online, error: onlineError }] = await Promise.all([
        admin.from("live_chats").select("id, status, customer_id, customer_name, created_at, updated_at").eq("status", "waiting").order("created_at", { ascending: true }).limit(50),
        admin.from("live_chats").select("id, status, assigned_agent, customer_id, customer_name, created_at, updated_at").eq("assigned_agent", agent.userId).eq("status", "active").order("updated_at", { ascending: false }).limit(50),
        admin.from("team_agents").select("display_name").eq("active", true).gt("online_until", now)
      ]);
      if (waitingError || assignedError || onlineError) throw waitingError ?? assignedError ?? onlineError;
      const chats = [...(waiting ?? []), ...(assigned ?? [])];
      const messagesByChat = new Map<string, Awaited<ReturnType<typeof loadMessages>>>();
      if (chats.length) {
        const { data: messages, error } = await admin.from("live_chat_messages")
          .select("id, chat_id, sender_role, sender_id, sender_name, body, created_at")
          .in("chat_id", chats.map((chat) => chat.id)).order("created_at", { ascending: true }).limit(5000);
        if (error) throw error;
        for (const message of messages ?? []) {
          const current = messagesByChat.get(message.chat_id) ?? [];
          current.push(message);
          messagesByChat.set(message.chat_id, current);
        }
      }
      const summaries = chats.map((chat) => ({ ...chat, messages: messagesByChat.get(chat.id) ?? [] }));
      const customers = new URL(request.url).searchParams.get("view") === "queries" ? await loadCustomerHistories(admin) : [];
      return NextResponse.json({ role: "team", currentAgentId: agent.userId, chats: summaries, customers, onlineAgents: (online ?? []).map((item) => item.display_name) });
    }

    if (!request.headers.has("authorization")) return NextResponse.json({ error: "Please sign in before opening your chat history." }, { status: 401 });
    const customer = await getCustomer(request);
    if (!customer) return NextResponse.json({ error: "Sign in with a customer account to continue." }, { status: 401 });
    const visitorToken = new URL(request.url).searchParams.get("visitorToken") ?? "";
    if (!isValidVisitorToken(visitorToken)) return NextResponse.json({ error: "Invalid visitor session." }, { status: 400 });
    const [{ data: chat, error: chatError }, { data: online, error: onlineError }] = await Promise.all([
      admin.from("live_chats").select("id, status, assigned_agent, created_at").eq("visitor_token_hash", hashVisitorToken(visitorToken)).eq("customer_id", customer.userId).maybeSingle(),
      admin.from("team_agents").select("user_id").eq("active", true).gt("online_until", new Date().toISOString())
    ]);
    if (chatError || onlineError) throw chatError ?? onlineError;
    if (!chat || chat.status === "closed") {
      return NextResponse.json({ role: "customer", chat: null, onlineAgents: online?.length ?? 0 });
    }
    const messages = await loadMessages(admin, chat.id);
    let assignedAgent: string | null = null;
    if (chat.assigned_agent) {
      const { data: assigned } = await admin.from("team_agents").select("display_name").eq("user_id", chat.assigned_agent).maybeSingle();
      assignedAgent = assigned?.display_name ?? "SurfSync team";
    }
    return NextResponse.json({ role: "customer", chat, messages, assignedAgent, onlineAgents: online?.length ?? 0 });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return unavailable();
  const clientKey = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`handoff:${clientKey}`)) return NextResponse.json({ error: "Too many chat actions. Please wait a moment and try again." }, { status: 429 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (typeof input !== "object" || input === null || !("action" in input) || typeof input.action !== "string") {
    return NextResponse.json({ error: "Choose a live chat action." }, { status: 400 });
  }
  const data = input as Record<string, unknown>;

  try {
    const admin = getAdmin();
    const visitorAction = typeof data.action === "string" && ["request", "visitor-message", "visitor-close"].includes(data.action);
    const customer = visitorAction ? await getCustomer(request) : null;
    if (visitorAction && !customer) return NextResponse.json({ error: "Sign in with a customer account before using live chat." }, { status: 401 });
    if (data.action === "request") {
      if (typeof data.visitorToken !== "string" || !isValidVisitorToken(data.visitorToken)) return NextResponse.json({ error: "Invalid visitor session." }, { status: 400 });
      if (!Array.isArray(data.history) || data.history.length > 1000 || data.history.some((item) => typeof item !== "object" || item === null || !("role" in item) || !["user", "assistant"].includes(String(item.role)) || !("content" in item) || typeof item.content !== "string" || !item.content.trim() || item.content.length > 4000)) {
        return NextResponse.json({ error: "The conversation could not be shared. Please start a new chat." }, { status: 400 });
      }
      const tokenHash = hashVisitorToken(data.visitorToken);
      const { data: existing, error: lookupError } = await admin.from("live_chats").select("id, status, assigned_agent").eq("visitor_token_hash", tokenHash).eq("customer_id", customer!.userId).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) return NextResponse.json({ chat: existing });

      const { data: chat, error: createError } = await admin.from("live_chats").insert({ visitor_token_hash: tokenHash, customer_id: customer!.userId, customer_name: customer!.name }).select("id, status, assigned_agent").single();
      if (createError || !chat) throw createError ?? new Error("Unable to create live chat.");
      const transcript = (data.history as { role: "user" | "assistant"; content: string }[]).map((message) => ({
        chat_id: chat.id,
        sender_role: message.role === "user" ? "visitor" : "assistant",
        sender_name: message.role === "user" ? customer!.name : "SurfSync assistant",
        body: message.content.trim()
      }));
      if (transcript.length) {
        const { error } = await admin.from("live_chat_messages").insert(transcript);
        if (error) {
          await admin.from("live_chats").delete().eq("id", chat.id);
          throw error;
        }
      }
      return NextResponse.json({ chat }, { status: 201 });
    }

    if (data.action === "visitor-message") {
      if (typeof data.visitorToken !== "string" || !isValidVisitorToken(data.visitorToken) || typeof data.chatId !== "string" || !asMessage(data)) return NextResponse.json({ error: "Check your message and try again." }, { status: 400 });
      const { data: chat, error } = await admin.from("live_chats").select("id, status").eq("id", data.chatId).eq("visitor_token_hash", hashVisitorToken(data.visitorToken)).eq("customer_id", customer!.userId).maybeSingle();
      if (error) throw error;
      if (!chat || !["waiting", "active"].includes(chat.status)) return NextResponse.json({ error: "This live chat has ended. Please start a new enquiry." }, { status: 409 });
      const { error: insertError } = await admin.from("live_chat_messages").insert({ chat_id: chat.id, sender_role: "visitor", sender_name: customer!.name, body: data.text.trim() });
      if (insertError) throw insertError;
      await admin.from("live_chats").update({ updated_at: new Date().toISOString() }).eq("id", chat.id);
      return NextResponse.json({ success: true });
    }
    if (data.action === "visitor-close") {
      if (typeof data.visitorToken !== "string" || !isValidVisitorToken(data.visitorToken) || typeof data.chatId !== "string") return NextResponse.json({ error: "Invalid visitor session." }, { status: 400 });
      const { data: closed, error } = await admin.from("live_chats").update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", data.chatId).eq("visitor_token_hash", hashVisitorToken(data.visitorToken)).eq("customer_id", customer!.userId).in("status", ["waiting", "active"]).select("id").maybeSingle();
      if (error) throw error;
      if (!closed) return NextResponse.json({ error: "This chat is already closed." }, { status: 409 });
      return NextResponse.json({ success: true });
    }

    const agent = await getTeamAgent(request);
    if (!agent) return NextResponse.json({ error: "Please sign in with an active team account." }, { status: 401 });

    if (data.action === "heartbeat") {
      const { error } = await admin.from("team_agents").update({ online_until: new Date(Date.now() + 45_000).toISOString() }).eq("user_id", agent.userId);
      if (error) throw error;
      return NextResponse.json({ online: true });
    }
    if (data.action === "offline") {
      const { error } = await admin.from("team_agents").update({ online_until: null }).eq("user_id", agent.userId);
      if (error) throw error;
      return NextResponse.json({ online: false });
    }

    if (typeof data.chatId !== "string") return NextResponse.json({ error: "Select a chat first." }, { status: 400 });
    if (data.action === "accept") {
      const { data: onlineAgent, error: presenceError } = await admin.from("team_agents").select("user_id")
        .eq("user_id", agent.userId).gt("online_until", new Date().toISOString()).maybeSingle();
      if (presenceError) throw presenceError;
      if (!onlineAgent) return NextResponse.json({ error: "Open the team inbox in a visible tab before accepting a chat." }, { status: 409 });
      const { data: accepted, error } = await admin.from("live_chats").update({ status: "active", assigned_agent: agent.userId, updated_at: new Date().toISOString() })
        .eq("id", data.chatId).eq("status", "waiting").is("assigned_agent", null).select("id, status, assigned_agent").maybeSingle();
      if (error) throw error;
      if (!accepted) return NextResponse.json({ error: "Another team member already accepted this request." }, { status: 409 });
      await admin.from("live_chat_messages").insert({ chat_id: accepted.id, sender_role: "system", sender_name: "SurfSync", body: `${agent.name} joined the chat.` });
      return NextResponse.json({ chat: accepted });
    }

    const { data: chat, error: chatError } = await admin.from("live_chats").select("id, status, assigned_agent").eq("id", data.chatId).maybeSingle();
    if (chatError) throw chatError;
    if (!chat || chat.assigned_agent !== agent.userId || chat.status !== "active") return NextResponse.json({ error: "This chat isn't assigned to you." }, { status: 403 });

    if (data.action === "agent-message") {
      if (!asMessage(data)) return NextResponse.json({ error: "Enter a message before sending." }, { status: 400 });
      const { error } = await admin.from("live_chat_messages").insert({ chat_id: chat.id, sender_role: "agent", sender_id: agent.userId, sender_name: agent.name, body: data.text.trim() });
      if (error) throw error;
      await admin.from("live_chats").update({ updated_at: new Date().toISOString() }).eq("id", chat.id);
      return NextResponse.json({ success: true });
    }
    if (data.action === "close") {
      const { error } = await admin.from("live_chats").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", chat.id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown live chat action." }, { status: 400 });
  } catch {
    return unavailable();
  }
}
