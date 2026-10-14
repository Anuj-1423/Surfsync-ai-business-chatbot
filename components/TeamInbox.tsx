"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type ThreadMessage = { id: number; sender_role: "visitor" | "assistant" | "agent" | "system"; sender_id?: string | null; sender_name: string; body: string; created_at: string };
type Chat = { id: string; status: "waiting" | "active"; assigned_agent?: string | null; customer_id: string | null; customer_name: string; created_at: string; updated_at: string; messages: ThreadMessage[] };
type CustomerQuery = { id: number; conversation_id: string; question: string; answer: string; created_at: string };
type CustomerHistory = { userId: string; name: string; queries: CustomerQuery[] };

export default function TeamInbox({ embedded = false, loginEnabled, onTeamAuthChange }: { embedded?: boolean; loginEnabled?: boolean; onTeamAuthChange?: (signedIn: boolean) => void }) {
  const router = useRouter();
  const canLogin = loginEnabled ?? embedded;
  const supabase = useMemo(() => getBrowserSupabase("team"), []);
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [customerHistories, setCustomerHistories] = useState<CustomerHistory[]>([]);
  const [onlineAgents, setOnlineAgents] = useState<string[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [inboxView, setInboxView] = useState<"requests" | "queries">("requests");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    onTeamAuthChange?.(Boolean(accessToken));
  }, [accessToken, onTeamAuthChange]);

  useEffect(() => {
    if (!supabase) {
      if (!canLogin) router.replace("/");
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAccessToken(data.session.access_token);
      else if (!canLogin) router.replace("/");
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? "");
      if (!session && !canLogin) router.replace("/");
    });
    return () => authListener.subscription.unsubscribe();
  }, [canLogin, router, supabase]);

  const request = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "That action couldn't be completed.");
    return result;
  }, [accessToken]);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`/api/handoff?view=${inboxView}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn't load the inbox.");
      if (result.role !== "team") {
        setError("This account isn't enabled for the SurfSync team inbox.");
        await supabase?.auth.signOut();
        setAccessToken("");
        return;
      }
      setChats(result.chats ?? []);
      setCustomerHistories(result.customers ?? []);
      setCurrentAgentId(result.currentAgentId ?? "");
      setSelectedCustomerId((current) => current || result.customers?.[0]?.userId || "");
      setOnlineAgents(result.onlineAgents ?? []);
      setSelectedId((current) => current || result.chats?.find((chat: Chat) => chat.status === "active")?.id || result.chats?.[0]?.id || "");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load the inbox.");
    }
  }, [accessToken, inboxView, supabase]);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
    void request({ action: "heartbeat" }).catch((cause) => setError(cause instanceof Error ? cause.message : "Presence update failed."));
    const poll = window.setInterval(() => void refresh(), inboxView === "queries" ? 10_000 : 2500);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void request({ action: "heartbeat" }).catch(() => undefined);
    }, 15_000);
    return () => { window.clearInterval(poll); window.clearInterval(heartbeat); };
  }, [accessToken, inboxView, refresh, request]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError("");
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError || !data.session) { setError("Sign in failed. Use an account enabled for the SurfSync team inbox."); return; }
    setAccessToken(data.session.access_token);
  }

  async function signOut() {
    try { await request({ action: "offline" }); } catch { /* Session can expire between polls. */ }
    await supabase?.auth.signOut();
    setAccessToken(""); setChats([]); setSelectedId("");
  }

  async function accept(chatId: string) {
    setBusy(true); setError("");
    try { await request({ action: "accept", chatId }); setSelectedId(chatId); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't accept the chat."); }
    finally { setBusy(false); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selectedId || busy) return;
    setBusy(true); setError("");
    try { await request({ action: "agent-message", chatId: selectedId, text }); setDraft(""); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Message wasn't sent."); }
    finally { setBusy(false); }
  }

  async function closeChat() {
    if (!selectedId) return;
    setBusy(true);
    try { await request({ action: "close", chatId: selectedId }); setSelectedId(""); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't close this chat."); }
    finally { setBusy(false); }
  }

  const selectedChat = chats.find((chat) => chat.id === selectedId);
  const selectedCustomer = customerHistories.find((customer) => customer.userId === selectedCustomerId);
  const waiting = chats.filter((chat) => chat.status === "waiting");
  const active = chats.filter((chat) => chat.status === "active");
  const PanelContainer = embedded ? "section" : "main";

  if (!accessToken && !canLogin) return (
    <PanelContainer className={embedded ? "team-embedded team-embedded-login" : "team-login-shell"} aria-busy="true">
      <div className="inbox-empty-state"><h2>Opening team sign-in...</h2></div>
    </PanelContainer>
  );

  if (!accessToken) return (
    <PanelContainer className={embedded ? "team-embedded team-embedded-login" : "team-login-shell"}>
      <form className="team-login-card" onSubmit={(event) => void signIn(event)}>
        {!embedded && <a className="team-back-link" href="/">â† Back to SurfSync chat</a>}
        <div className="eyebrow">SURFSYNC TEAM</div>
        <h1>{embedded ? "Team member panel" : "Team inbox"}</h1>
        <p>Sign in to appear online, receive visitor requests, and accept live chats. Visitors can use the chat panel beside this one.</p>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="team-error" role="alert">{error}</p>}
        {!supabase && <p className="team-error">Supabase Auth isn't configured for this project yet.</p>}
        <button className="submit-button" disabled={busy || !supabase}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </PanelContainer>
  );

  return (
    <PanelContainer className={embedded ? "team-embedded team-embedded-inbox" : "team-inbox-shell"}>
      <header className="team-inbox-header">
        <div><a className="team-back-link" href="/">â† SurfSync</a><h1>Team inbox</h1></div>
        <div className="team-presence"><i /> Online · {onlineAgents.length} {onlineAgents.length === 1 ? "member" : "members"}<button type="button" onClick={() => void signOut()}>Sign out</button></div>
      </header>
      {error && <p className="team-error team-banner" role="alert">{error}</p>}
      <div className="inbox-tabs" role="tablist" aria-label="Team inbox sections">
        <button type="button" className={inboxView === "requests" ? "selected" : ""} onClick={() => setInboxView("requests")}>Requests</button>
        <button type="button" className={inboxView === "queries" ? "selected" : ""} onClick={() => { setInboxView("queries"); setSelectedCustomerId((current) => current || customerHistories[0]?.userId || ""); }}>User queries</button>
      </div>
      <div className="inbox-grid">
        {inboxView === "requests" ? <aside className="inbox-sidebar">
          <section><h2>Waiting <span>{waiting.length}</span></h2>
            {waiting.length === 0 ? <p className="empty-inbox">No requests waiting.</p> : waiting.map((chat) => <button className={`inbox-item ${selectedId === chat.id ? "selected" : ""}`} key={chat.id} onClick={() => setSelectedId(chat.id)}>
              <strong>{chat.customer_name}</strong><time>{new Date(chat.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
              <small>{chat.messages.at(-1)?.body ?? "Requested a team member"}</small>
            </button>)}
          </section>
          <section><h2>My active chats <span>{active.length}</span></h2>
            {active.length === 0 ? <p className="empty-inbox">Accept a request to start chatting.</p> : active.map((chat) => <button className={`inbox-item ${selectedId === chat.id ? "selected" : ""}`} key={chat.id} onClick={() => setSelectedId(chat.id)}>
              <strong>{chat.customer_name}</strong><time>{new Date(chat.updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
              <small>{chat.messages.at(-1)?.body ?? "Live chat"}</small>
            </button>)}
          </section>
        </aside> : <aside className="inbox-sidebar">
          <section><h2>Customers <span>{customerHistories.length}</span></h2>
            {customerHistories.length === 0 ? <p className="empty-inbox">No signed-in customer queries yet.</p> : customerHistories.map((customer) => <button className={`inbox-item ${selectedCustomerId === customer.userId ? "selected" : ""}`} key={customer.userId} onClick={() => setSelectedCustomerId(customer.userId)}>
              <strong>{customer.name}</strong><time>{customer.queries.length}</time>
              <small>{customer.queries.at(-1)?.question ?? "No queries"}</small>
            </button>)}
          </section>
        </aside>}
        <section className="inbox-thread">
          {inboxView === "queries" ? !selectedCustomer ? <div className="inbox-empty-state"><span>↗</span><h2>Choose a customer</h2><p>Their chatbot questions and answers appear here.</p></div> : <>
            <header className="thread-header"><div><strong>{selectedCustomer.name}</strong><span>{selectedCustomer.queries.length} chatbot queries</span></div></header>
            <div className="thread-messages customer-query-history">{selectedCustomer.queries.length === 0 ? <p className="empty-inbox">No chatbot queries from this customer yet.</p> : selectedCustomer.queries.map((query) => <article className="customer-query" key={query.id}>
              <time>{new Date(query.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time>
              <strong>Customer asked</strong><p>{query.question}</p>
              <strong>Chatbot replied</strong><p>{query.answer}</p>
            </article>)}</div>
          </> : !selectedChat ? <div className="inbox-empty-state"><span>↗</span><h2>Choose a conversation</h2><p>Incoming requests will appear here while you are online.</p></div> : <>
            <header className="thread-header"><div><strong>{selectedChat.customer_name}</strong><span>{selectedChat.status === "waiting" ? "Waiting for a team member" : "Live conversation"}</span></div>
              {selectedChat.status === "waiting" ? <button className="submit-button" disabled={busy} onClick={() => void accept(selectedChat.id)}>Accept chat</button> : <button className="cancel-button" disabled={busy} onClick={() => void closeChat()}>End chat</button>}
            </header>
            <div className="thread-messages">{selectedChat.messages.map((message) => <article className={`thread-message ${message.sender_role}`} key={message.id}>
              <div><strong>{message.sender_role === "agent" && message.sender_id === currentAgentId ? "You" : message.sender_role === "visitor" ? selectedChat.customer_name : message.sender_name}</strong><time>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><p>{message.body}</p>
            </article>)}</div>
            {selectedChat.status === "active" && <form className="thread-composer" aria-label="Reply to customer" onSubmit={(event) => void send(event)}><textarea aria-label="Message to customer" rows={2} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} placeholder="Write a reply..." /><button className="submit-button" disabled={busy || !draft.trim()}>Send</button></form>}
          </>}
        </section>
      </div>
    </PanelContainer>
  );
}
