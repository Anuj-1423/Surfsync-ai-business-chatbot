"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/validation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type CustomerAccount = { id: string; name: string; email: string; accessToken: string };

type DisplayMessage = ChatMessage & { id: number; time: string };
type LiveChat = { id: string; status: "waiting" | "active" | "closed"; assignedAgent?: string | null };
type EnquiryStage = "consent" | "name" | "email" | "phone" | "service" | "description" | "budget" | "timeline" | null;
type Service = "AI & Automation" | "Web Development" | "Mobile Development" | "E-commerce & CMS" |
  "WhatsApp Business API" | "Digital Marketing" | "Logo & Brand Design" | "Shopify Development" |
  "n8n Workflow Automation" |
  "Cloud & DevOps" | "Enterprise IT Solutions" | "UI/UX Design" | "Analytics setup" |
  "Training & Documentation" | "Swagat Suite" | "HRMS" | "Sales CRM" | "PatronPing" | "Not sure yet";

const greeting: ChatMessage = { role: "assistant", content: "Hi! What are you hoping to build or improve?" };
const services: Service[] = [
  "AI & Automation",
  "Web Development",
  "Mobile Development",
  "E-commerce & CMS",
  "WhatsApp Business API",
  "Digital Marketing",
  "Logo & Brand Design",
  "Shopify Development",
  "n8n Workflow Automation",
  "Cloud & DevOps",
  "Enterprise IT Solutions",
  "UI/UX Design",
  "Analytics setup",
  "Training & Documentation",
  "Swagat Suite",
  "HRMS",
  "Sales CRM",
  "PatronPing",
  "Not sure yet"
];
const suggestions = [
  "What services do you offer?",
  "I need a mobile app",
  "Tell me about your pricing",
  "How can I contact the team?"
];

function formatTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function renderMessageText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+|\/projects\/[a-z0-9-]+)/gi);
  return parts.flatMap((part, index) => {
    if (!/^https?:\/\//i.test(part) && !/^\/projects\//i.test(part)) return [part];
    const url = part.replace(/[.,!?;:]+$/, "");
    const punctuation = part.slice(url.length);
    return [<a href={url} key={`${index}-${url}`} target={url.startsWith("http") ? "_blank" : undefined} rel={url.startsWith("http") ? "noreferrer" : undefined}>{url}</a>, punctuation];
  });
}

function inferService(conversation: string): Service | undefined {
  const options: [Service, RegExp][] = [
    ["Digital Marketing", /\b(digital marketing|seo|google ads|meta ads|lead generation)\b/i],
    ["Logo & Brand Design", /\b(logo|brand identity)\b/i],
    ["Shopify Development", /\bshopify\b/i],
    ["n8n Workflow Automation", /\bn8n\b/i],
    ["WhatsApp Business API", /\bwhatsapp\b/i],
    ["Mobile Development", /\b(mobile|android|ios|flutter|react native)\b/i],
    ["E-commerce & CMS", /\b(e-?commerce|online store|shopify)\b/i],
    ["AI & Automation", /\b(ai|automation|chatbot|workflow)\b/i],
    ["Cloud & DevOps", /\b(cloud|devops)\b/i],
    ["Enterprise IT Solutions", /\b(enterprise|hrms|saas|crm)\b/i],
    ["UI/UX Design", /\b(ui\/ux|design)\b/i],
    ["Web Development", /\b(website|web site|web development|landing page)\b/i]
  ];
  return options.find(([, pattern]) => pattern.test(conversation))?.[0];
}

export default function ChatWidget({ loginEnabled = true, onCustomerAuthChange }: { loginEnabled?: boolean; onCustomerAuthChange?: (signedIn: boolean, checking: boolean) => void }) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase("customer"), []);
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([{ ...greeting, id: 0, time: "Just now" }]);
  const [chatEnded, setChatEnded] = useState(false);
  const [draft, setDraft] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [liveChat, setLiveChat] = useState<LiveChat | null>(null);
  const [onlineAgents, setOnlineAgents] = useState(0);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [enquiryStage, setEnquiryStage] = useState<EnquiryStage>(null);
  const [enquiryData, setEnquiryData] = useState({ name: "", email: "", phone: "", service: "Not sure yet" as Service, description: "", budget: "", timeline: "" });
  const messageId = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const submissionIdRef = useRef<string | null>(null);
  const visitorTokenRef = useRef("");
  const conversationIdRef = useRef("");
  const hydratedCustomerIdRef = useRef("");

  useEffect(() => {
    onCustomerAuthChange?.(Boolean(customer), authLoading);
  }, [customer, authLoading, onCustomerAuthChange]);

  useEffect(() => {
    if (!loginEnabled && !authLoading && !customer) router.replace("/");
  }, [authLoading, customer, loginEnabled, router]);

  const syncCustomer = useCallback(async (session: { access_token: string; user: { id: string } } | null) => {
    if (!session) {
      setCustomer(null);
      setLiveChat(null);
      setEnquiryStage(null);
      setEnquiryData({ name: "", email: "", phone: "", service: "Not sure yet", description: "", budget: "", timeline: "" });
      setMessages([{ ...greeting, id: 0, time: "Just now" }]);
      hydratedCustomerIdRef.current = "";
      setAuthLoading(false);
      return;
    }
    setAuthLoading(true);
    try {
      const savedConversationId = window.localStorage.getItem(`surfsync-conversation:${session.user.id}`);
      const query = savedConversationId ? `?conversationId=${encodeURIComponent(savedConversationId)}` : "";
      const response = await fetch(`/api/customer${query}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.user) {
        setAuthError(result.error || "This account can't use the visitor chat. Sign in with a customer account.");
        setCustomer(null);
        await supabase?.auth.signOut();
        return;
      }
      setAuthError("");
      setAuthNotice("");
      setCustomer({ ...result.user, accessToken: session.access_token });
      if (hydratedCustomerIdRef.current !== result.user.id) {
        const conversationId = result.conversationId || savedConversationId || crypto.randomUUID();
        conversationIdRef.current = conversationId;
        window.localStorage.setItem(`surfsync-conversation:${result.user.id}`, conversationId);
        const history = Array.isArray(result.history) ? result.history : [];
        setMessages(history.length ? history.map((message: ChatMessage, index: number) => ({
          ...message,
          id: index + 1,
          time: "Previous chat"
        })) : [{ ...greeting, id: 0, time: "Just now" }]);
        messageId.current = history.length;
        hydratedCustomerIdRef.current = result.user.id;
      }
    } catch {
      setAuthError("We couldn't verify your account. Please try again.");
      setCustomer(null);
    } finally { setAuthLoading(false); }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => { void syncCustomer(session); });
    void supabase.auth.getSession().then(({ data }) => syncCustomer(data.session));
    return () => authListener.subscription.unsubscribe();
  }, [supabase, syncCustomer]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isWaiting]);

  useEffect(() => {
    if (!customer) return;
    const key = `surfsync-live-visitor-token:${customer.id}`;
    const visitorToken = window.localStorage.getItem(key) || crypto.randomUUID();
    visitorTokenRef.current = visitorToken;
    window.localStorage.setItem(key, visitorToken);
    let conversationId = window.localStorage.getItem(`surfsync-conversation:${customer.id}`);
    if (!conversationId) {
      conversationId = crypto.randomUUID();
      window.localStorage.setItem(`surfsync-conversation:${customer.id}`, conversationId);
    }
    conversationIdRef.current = conversationId;
    let mounted = true;
    const refresh = async () => {
      const requestedVisitorToken = visitorTokenRef.current;
      try {
        const response = await fetch(`/api/handoff?visitorToken=${encodeURIComponent(requestedVisitorToken)}`, { headers: { Authorization: `Bearer ${customer.accessToken}` }, cache: "no-store" });
        const result = await response.json();
        if (!mounted || requestedVisitorToken !== visitorTokenRef.current || !response.ok) return;
        setOnlineAgents(result.onlineAgents ?? 0);
        if (result.chat) {
          setLiveChat({ ...result.chat, assignedAgent: result.assignedAgent ?? result.chat.assignedAgent });
          if (Array.isArray(result.messages)) {
            setMessages(result.messages.map((message: { id: number; sender_role: string; body: string; created_at: string }, index: number) => ({
              id: Number(message.id) || index + 1,
              role: message.sender_role === "visitor" ? "user" : "assistant",
              content: message.body,
              time: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(message.created_at))
            })));
          }
        }
      } catch { /* Keep the current chat usable if a background status check fails. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [customer?.id, customer?.accessToken]);

  async function sendMessage(rawText: string) {
    const message = rawText.trim();
    if (!message || isWaiting) return;
    const priorMessages = messages
      .filter((message) => !(message.id === 0 && message.role === "assistant" && message.content === greeting.content))
      .map(({ role, content }) => ({ role, content }))
      .slice(-9);
    setMessages((current) => [...current, { role: "user", content: message, id: ++messageId.current, time: formatTime() }]);
    setChatEnded(false);
    setDraft("");
    if (!enquiryStage && /\b(start|submit|send|make|create|leave|raise)\b.{0,50}\b(project )?(enquir(y|ies)|inquir(y|ies))\b|\b(project )?(enquir(y|ies)|inquir(y|ies))\b.{0,40}\b(start|submit|send|make|create|leave|raise)\b|^\s*(project )?(enquir(y|ies)|inquir(y|ies))\s*$/i.test(message)) {
      submissionIdRef.current = null;
      setEnquiryStage("consent");
      setEnquiryData({ name: "", email: "", phone: "", service: "Not sure yet", description: "", budget: "", timeline: "" });
      setMessages((current) => [...current, { role: "assistant", content: "I can take your project enquiry here. Before we begin: do you agree that SurfSync may use the details you share to respond, store them for this request, and email them to the team? Please reply yes or no. You can cancel at any time.", id: ++messageId.current, time: formatTime() }]);
      return;
    }
    if (enquiryStage) {
      await handleEnquiryReply(message);
      return;
    }
    setIsWaiting(true);
    try {
      if (liveChat && liveChat.status !== "closed") {
        const response = await fetch("/api/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer?.accessToken ?? ""}` },
          body: JSON.stringify({ action: "visitor-message", visitorToken: visitorTokenRef.current, chatId: liveChat.id, text: message })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Your message wasn't sent. Please try again.");
        return;
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer?.accessToken ?? ""}` },
        body: JSON.stringify({ message, history: priorMessages, conversationId: conversationIdRef.current })
      });
      const result: { answer?: string; error?: string } = await response.json();
      if (!response.ok || !result.answer) {
        throw new Error(result.error || "I couldn't respond just now. Please try again.");
      }
      setMessages((current) => [...current, { role: "assistant", content: result.answer ?? "", id: ++messageId.current, time: formatTime() }]);
    } catch (error) {
      const text = error instanceof Error ? error.message : "I couldn't respond just now. Please try again.";
      setMessages((current) => [...current, {
        role: "assistant",
        content: `${text} You can also email info@surfsyncinfotech.in.`,
        id: ++messageId.current,
        time: formatTime()
      }]);
    } finally {
      setIsWaiting(false);
      inputRef.current?.focus();
    }
  }

  function askEnquiry(stage: Exclude<EnquiryStage, null>, question: string) {
    setEnquiryStage(stage);
    setMessages((current) => [...current, { role: "assistant", content: question, id: ++messageId.current, time: formatTime() }]);
  }

  async function handleEnquiryReply(value: string) {
    const answer = value.trim();
    const normalized = answer.toLowerCase();
    const skip = /^(skip|prefer not to say|not sure|n\/a|none)$/i.test(answer);
    if (/^(cancel|stop|abort|never mind)$/i.test(answer)) {
      submissionIdRef.current = null;
      setEnquiryStage(null);
      setEnquiryData({ name: "", email: "", phone: "", service: "Not sure yet", description: "", budget: "", timeline: "" });
      setMessages((current) => [...current, { role: "assistant", content: "Enquiry cancelled. I haven't submitted these details.", id: ++messageId.current, time: formatTime() }]);
      return;
    }
    setIsWaiting(true);
    try {
      switch (enquiryStage) {
        case "consent":
          if (/\b(yes|y|i agree|agree|okay|ok)\b/i.test(answer)) askEnquiry("name", "Thanks. What name should the team use?");
          else if (/^(no|n|no thanks|cancel|stop)$/i.test(answer)) {
            setEnquiryStage(null);
            setMessages((current) => [...current, { role: "assistant", content: "No problem. I won't collect or submit an enquiry. You can keep chatting without sharing personal details.", id: ++messageId.current, time: formatTime() }]);
          } else askEnquiry("consent", "Please reply yes if you agree, or no to cancel. I won't ask for personal details until you agree.");
          break;
        case "name":
          if (answer.length < 2 || answer.length > 100) askEnquiry("name", "Please enter a name between 2 and 100 characters.");
          else { setEnquiryData((data) => ({ ...data, name: answer })); askEnquiry("email", "What email address can the team use to reply?"); }
          break;
        case "email":
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer) || answer.length > 254) askEnquiry("email", "That email doesn't look valid. Please enter it again.");
          else { setEnquiryData((data) => ({ ...data, email: answer })); askEnquiry("phone", "Would you like to share a phone number? It's optional; reply skip to leave it blank."); }
          break;
        case "phone":
          if (!skip && !/^(no thanks|rather not)$/i.test(answer) && !/^[+\d][\d\s().-]{5,38}$/.test(answer)) askEnquiry("phone", "Please enter a valid phone number, or reply skip/no thanks to leave it blank.");
          else { setEnquiryData((data) => ({ ...data, phone: skip || /^(no thanks|rather not)$/i.test(answer) ? "" : answer })); askEnquiry("service", `Which service do you need? You can name one, such as ${services.slice(0, 9).join(", ")}, or describe it in your own words.`); }
          break;
        case "service": {
          const service = inferService(answer) ?? "Not sure yet";
          setEnquiryData((data) => ({ ...data, service }));
          askEnquiry("description", "Briefly describe what you want to build or improve (at least 10 characters).");
          break;
        }
        case "description":
          if (answer.length < 10 || answer.length > 2000) askEnquiry("description", "Please add a little more detail (10â€“2,000 characters) so the team understands the request.");
          else { setEnquiryData((data) => ({ ...data, description: answer })); askEnquiry("budget", "Do you have an estimated budget? You can share a range or reply skip."); }
          break;
        case "budget":
          if (answer.length > 100) askEnquiry("budget", "Please keep the budget to 100 characters or fewer, or reply skip.");
          else { setEnquiryData((data) => ({ ...data, budget: skip ? "" : answer })); askEnquiry("timeline", "What timeline are you aiming for? You can reply skip if you're unsure."); }
          break;
        case "timeline": {
          const completed = { ...enquiryData, timeline: skip ? "" : answer };
          setEnquiryData(completed);
          submissionIdRef.current ??= crypto.randomUUID();
          const payload = { submissionId: submissionIdRef.current, ...completed, consent: true };
          const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          const result: { reference?: string; emailSent?: boolean; error?: string } = await response.json();
          if (!response.ok) throw new Error(result.error || "I couldn't save the enquiry. Please try again.");
          submissionIdRef.current = null;
          setEnquiryStage(null);
          setEnquiryData({ name: "", email: "", phone: "", service: "Not sure yet", description: "", budget: "", timeline: "" });
          setMessages((current) => [...current, { role: "assistant", content: result.emailSent ? `Thanks, ${completed.name}. Your project enquiry has been saved and sent to the SurfSync team. Reference: ${result.reference}.` : `Thanks, ${completed.name}. Your enquiry was saved (reference ${result.reference}), but the email alert could not be sent. Please contact info@surfsyncinfotech.in so the team receives it.`, id: ++messageId.current, time: formatTime() }]);
          break;
        }
        default: break;
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "I couldn't save the enquiry. Please try again.";
      setMessages((current) => [...current, { role: "assistant", content: `${text} Your details have not been submitted.`, id: ++messageId.current, time: formatTime() }]);
    } finally {
      setIsWaiting(false);
      inputRef.current?.focus();
    }
  }

  async function requestTeamMember() {
    if (handoffBusy || liveChat?.status === "waiting" || liveChat?.status === "active") return;
    if (!window.confirm("A SurfSync team member will be able to read this conversation so they can help you. Would you like to share it and request a live chat?")) return;
    setHandoffBusy(true);
    try {
      if (!visitorTokenRef.current || liveChat?.status === "closed") {
        visitorTokenRef.current = crypto.randomUUID();
        if (customer) window.localStorage.setItem(`surfsync-live-visitor-token:${customer.id}`, visitorTokenRef.current);
      }
      const response = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer?.accessToken ?? ""}` },
        body: JSON.stringify({ action: "request", visitorToken: visitorTokenRef.current, history: messages.map(({ role, content }) => ({ role, content })) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn't reach the team inbox just now.");
      setLiveChat(result.chat);
    } catch (error) {
      const text = error instanceof Error ? error.message : "We couldn't reach the team inbox just now.";
      setMessages((current) => [...current, { role: "assistant", content: `${text} You can still leave a project enquiry or email info@surfsyncinfotech.in.`, id: ++messageId.current, time: formatTime() }]);
    } finally { setHandoffBusy(false); }
  }

  async function endChat() {
    if (isWaiting || handoffBusy) return;
    if (liveChat && liveChat.status !== "closed") {
      try {
        await fetch("/api/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer?.accessToken ?? ""}` },
          body: JSON.stringify({ action: "visitor-close", visitorToken: visitorTokenRef.current, chatId: liveChat.id })
        });
      } catch { /* Starting a local conversation remains available if the handoff service is offline. */ }
    }
    const newToken = crypto.randomUUID();
    visitorTokenRef.current = newToken;
    const newConversationId = crypto.randomUUID();
    conversationIdRef.current = newConversationId;
    if (customer) {
      window.localStorage.setItem(`surfsync-live-visitor-token:${customer.id}`, newToken);
      window.localStorage.setItem(`surfsync-conversation:${customer.id}`, newConversationId);
    }
    setLiveChat(null);
    messageId.current = 0;
    setMessages([]);
    setChatEnded(true);
    setEnquiryStage(null);
    setEnquiryData({ name: "", email: "", phone: "", service: "Not sure yet", description: "", budget: "", timeline: "" });
    setDraft("");
    inputRef.current?.focus();
  }

  async function submitAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || authBusy) return;
    setAuthBusy(true); setAuthError(""); setAuthNotice("");
    try {
      if (authMode === "register") {
        if (authName.trim().length < 2) throw new Error("Enter your name to create an account.");
        if (authPassword.length < 8) throw new Error("Use a password with at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { data: { full_name: authName.trim() } }
        });
        if (error) throw error;
        if (data.session) await syncCustomer(data.session);
        else setAuthNotice("Your account is created. Check your email to confirm it, then sign in here.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error || !data.session) throw new Error("Sign-in failed. Check your email and password, or create a customer account.");
        await syncCustomer(data.session);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn't complete sign-in. Please try again.");
    } finally { setAuthBusy(false); }
  }

  async function signOutCustomer() {
    if (liveChat && liveChat.status !== "closed" && customer) {
      try {
        await fetch("/api/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer.accessToken}` },
          body: JSON.stringify({ action: "visitor-close", visitorToken: visitorTokenRef.current, chatId: liveChat.id })
        });
      } catch { /* Sign out remains available if the handoff service is unavailable. */ }
    }
    await supabase?.auth.signOut();
    setLiveChat(null);
    setMessages([{ ...greeting, id: 0, time: "Just now" }]);
    setChatEnded(false);
  }

  function startGuidedEnquiry() {
    if (enquiryStage) return;
    submissionIdRef.current = null;
    setEnquiryData({ name: "", email: "", phone: "", service: "Not sure yet", description: "", budget: "", timeline: "" });
    setEnquiryStage("consent");
    setMessages((current) => [...current, { role: "assistant", content: "I can take your project enquiry here. Before we begin: do you agree that SurfSync may use the details you share to respond, store them for this request, and email them to the team? Please reply yes or no. You can cancel at any time.", id: ++messageId.current, time: formatTime() }]);
  }

  if (authLoading) return (
    <section className="chat-card account-gate" aria-label="Checking account">
      <div className="account-gate-content"><div className="eyebrow">SURFSYNC CHAT</div><h2>Checking your account...</h2></div>
    </section>
  );

  if (!customer) return (
    <section className={`chat-card account-gate${loginEnabled ? "" : " account-redirecting"}`} aria-label={loginEnabled ? "Customer sign in" : "Opening login page"}>
      {!loginEnabled ? <div className="account-gate-content"><h2>Opening login page...</h2></div> : <div className="account-gate-content">
        <div className="eyebrow">SURFSYNC CHAT</div>
        <h2>{authMode === "register" ? "Create your account" : "Sign in to continue"}</h2>
        <p>Create a customer account or sign in to chat with SurfSync. Your name and chatbot questions will be saved with your account and visible to the authorized SurfSync team.</p>
        <div className="auth-mode-switch" role="tablist" aria-label="Account options">
          <button type="button" className={authMode === "login" ? "selected" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); setAuthNotice(""); }}>Sign in</button>
          <button type="button" className={authMode === "register" ? "selected" : ""} onClick={() => { setAuthMode("register"); setAuthError(""); setAuthNotice(""); }}>Create account</button>
        </div>
        <form className="customer-auth-form" onSubmit={(event) => void submitAuthentication(event)}>
          {authMode === "register" && <label>Your name<input value={authName} onChange={(event) => setAuthName(event.target.value)} autoComplete="name" required minLength={2} maxLength={100} /></label>}
          <label>Email<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} autoComplete="email" required maxLength={254} /></label>
          <label>Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} autoComplete={authMode === "register" ? "new-password" : "current-password"} required minLength={authMode === "register" ? 8 : 1} /></label>
          {authError && <p className="team-error" role="alert">{authError}</p>}
          {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
          {!supabase && <p className="team-error">Customer accounts aren't configured yet. Please contact SurfSync.</p>}
          <button className="submit-button" disabled={authBusy || !supabase}>{authBusy ? "Please wait..." : authMode === "register" ? "Create account" : "Sign in and chat"}</button>
        </form>
        <p className="team-login-hint">SurfSync team member? Sign in using the separate team panel.</p>
      </div>}
    </section>
  );

  return (
    <section className="chat-card" aria-label="Chat with SurfSync">
      <div className="chat-header">
        <div className="assistant-avatar" aria-hidden="true">S</div>
        <div className="assistant-info"><strong>SurfSync</strong><span><i /> Signed in as {customer.name}</span></div>
        <button className="account-signout" type="button" onClick={() => void signOutCustomer()}>Sign out</button>
        <button
          className="end-chat-button"
          type="button"
          aria-label="End chat"
          disabled={isWaiting || handoffBusy}
          onClick={() => void endChat()}
        >â†»</button>
      </div>

      <div className="messages" ref={messagesRef} role="log" aria-live="polite" aria-relevant="additions">
        {chatEnded && messages.length === 0 && <p className="chat-ended-note">This chat has ended. Send a message to start a new conversation.</p>}
        {messages.map((message) => (
          <article className={`message ${message.role === "user" ? "user-message" : "assistant-message"}`} key={message.id}>
            <div className="message-avatar" aria-hidden="true">{message.role === "user" ? "Y" : "S"}</div>
            <div className="message-content"><p>{renderMessageText(message.content)}</p><time>{message.time}</time></div>
          </article>
        ))}
        {isWaiting && (
          <article className="message assistant-message">
            <div className="message-avatar" aria-hidden="true">S</div>
            <div className="typing" aria-label="SurfSync is responding"><span /><span /><span /></div>
          </article>
        )}
      </div>

      <div className="suggestions" aria-label="Suggested questions">
        {suggestions.map((suggestion) => (
          <button className="suggestion" key={suggestion} type="button" disabled={isWaiting} onClick={() => void sendMessage(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <form className="composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }}>
        <label className="visually-hidden" htmlFor="message-input">Type your question</label>
        <textarea
          id="message-input"
          ref={inputRef}
          rows={1}
          maxLength={2000}
          placeholder="Tell us what you have in mind..."
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 92)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void sendMessage(draft);
            }
          }}
        />
        <button className="send-button" type="submit" aria-label="Send message" disabled={isWaiting || !draft.trim()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
      <div className="chat-footer">
        <span>{liveChat?.status === "active" ? `${liveChat.assignedAgent || "A team member"} joined. You're chatting live.` : liveChat?.status === "waiting" ? `Request sent. ${onlineAgents ? `${onlineAgents} team member${onlineAgents === 1 ? "" : "s"} online` : "Waiting for a team member"} to accept.` : onlineAgents ? `${onlineAgents} team member${onlineAgents === 1 ? "" : "s"} online Â· Share project details in the guided enquiry.` : "No team members online right now. You can still request a reply or leave an enquiry."}</span>
        {liveChat?.status !== "active" && liveChat?.status !== "waiting" && <button type="button" disabled={handoffBusy || isWaiting} onClick={() => void requestTeamMember()}>{handoffBusy ? "Connecting..." : "Talk to a person"}</button>}
        <button type="button" disabled={Boolean(enquiryStage)} onClick={startGuidedEnquiry}>{enquiryStage ? "Enquiry in progress" : "Start project enquiry"} <span aria-hidden="true">â†—</span></button>
      </div>


    </section>
  );
}
