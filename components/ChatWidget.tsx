"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/validation";

type DisplayMessage = ChatMessage & { id: number; time: string };
type LeadFieldErrors = Record<string, string>;
type Service = "AI & Automation" | "Web Development" | "Mobile Development" | "E-commerce & CMS" |
  "Cloud & DevOps" | "Enterprise IT Solutions" | "UI/UX Design" | "Analytics setup" |
  "Training & Documentation" | "Swagat Suite" | "HRMS" | "Sales CRM" | "PatronPing" | "Not sure yet";

const greeting: ChatMessage = { role: "assistant", content: "Hi! What are you hoping to build or improve?" };
const services: Service[] = [
  "AI & Automation",
  "Web Development",
  "Mobile Development",
  "E-commerce & CMS",
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

function inferService(conversation: string): Service | undefined {
  const options: [Service, RegExp][] = [
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

export default function ChatWidget() {
  const [messages, setMessages] = useState<DisplayMessage[]>([{ ...greeting, id: 0, time: "Just now" }]);
  const [draft, setDraft] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadStatus, setLeadStatus] = useState("");
  const [leadStatusIsError, setLeadStatusIsError] = useState(false);
  const [leadErrors, setLeadErrors] = useState<LeadFieldErrors>({});
  const [selectedService, setSelectedService] = useState<Service | "">("");
  const [projectDescription, setProjectDescription] = useState("");
  const messageId = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isWaiting]);

  async function sendMessage(rawText: string) {
    const message = rawText.trim();
    if (!message || isWaiting) return;
    const priorMessages = messages.slice(1).map(({ role, content }) => ({ role, content })).slice(-9);
    setMessages((current) => [...current, { role: "user", content: message, id: ++messageId.current, time: formatTime() }]);
    setDraft("");
    setIsWaiting(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: priorMessages })
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

  function openLeadForm() {
    const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
    const conversation = userMessages.join("\n").slice(-1800);
    setSelectedService(inferService(userMessages.join(" ")) ?? "");
    setProjectDescription(conversation);
    setLeadStatus("");
    setLeadStatusIsError(false);
    setLeadErrors({});
    submissionIdRef.current = null;
    setLeadOpen(true);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }

  function closeLeadForm() {
    dialogRef.current?.close();
    setLeadOpen(false);
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingLead || !formRef.current) return;
    setLeadErrors({});
    setLeadStatus("");
    setLeadStatusIsError(false);
    setIsSubmittingLead(true);
    submissionIdRef.current ??= crypto.randomUUID();
    const values = new FormData(formRef.current);
    const payload = {
      submissionId: submissionIdRef.current,
      name: String(values.get("name") ?? ""),
      email: String(values.get("email") ?? ""),
      phone: String(values.get("phone") ?? ""),
      service: String(values.get("service") ?? ""),
      description: String(values.get("description") ?? ""),
      budget: String(values.get("budget") ?? ""),
      timeline: String(values.get("timeline") ?? ""),
      consent: values.get("consent") === "on"
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result: { success?: boolean; reference?: string; error?: string; fields?: LeadFieldErrors } = await response.json();
      if (!response.ok) {
        if (result.fields) setLeadErrors(result.fields);
        throw new Error(result.error || "We couldn't save your enquiry. Please try again.");
      }
      submissionIdRef.current = null;
      setLeadStatus(`Thanks — your enquiry is saved. Reference ${result.reference}. The SurfSync team can follow up with you.`);
      setLeadStatusIsError(false);
      formRef.current.reset();
      setSelectedService("");
      setProjectDescription("");
    } catch (error) {
      setLeadStatus(error instanceof Error ? error.message : "We couldn't save your enquiry. Please try again.");
      setLeadStatusIsError(true);
    } finally {
      setIsSubmittingLead(false);
    }
  }

  return (
    <section className="chat-card" aria-label="Chat with SurfSync">
      <div className="chat-header">
        <div className="assistant-avatar" aria-hidden="true">S</div>
        <div className="assistant-info"><strong>SurfSync</strong><span><i /> Ready to help</span></div>
        <button
          className="icon-button"
          type="button"
          aria-label="Start a new conversation"
          title="New conversation"
          onClick={() => {
            messageId.current = 0;
            setMessages([{ ...greeting, id: 0, time: "Just now" }]);
            setDraft("");
            inputRef.current?.focus();
          }}
        >↻</button>
      </div>

      <div className="messages" ref={messagesRef} role="log" aria-live="polite" aria-relevant="additions">
        {messages.map((message) => (
          <article className={`message ${message.role === "user" ? "user-message" : "assistant-message"}`} key={message.id}>
            <div className="message-avatar" aria-hidden="true">{message.role === "user" ? "Y" : "S"}</div>
            <div className="message-content"><p>{message.content}</p><time>{message.time}</time></div>
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
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage(draft);
            }
          }}
        />
        <button className="send-button" type="submit" aria-label="Send message" disabled={isWaiting || !draft.trim()}>
          <span aria-hidden="true">↑</span>
        </button>
      </form>
      <div className="chat-footer">
        <span>Share contact details in the project enquiry form.</span>
        <button type="button" onClick={openLeadForm}>Use chat in enquiry <span aria-hidden="true">↗</span></button>
      </div>

      <dialog className="lead-dialog" ref={dialogRef} aria-labelledby="lead-title" onClose={() => setLeadOpen(false)}>
        {leadOpen && (
          <form id="lead-form" ref={formRef} noValidate onSubmit={(event) => void submitLead(event)}>
            <div className="dialog-heading">
              <div><div className="eyebrow">LET'S BUILD TOGETHER</div><h2 id="lead-title">Tell us about your project</h2></div>
              <button className="icon-button close-button" type="button" aria-label="Close form" onClick={closeLeadForm}>×</button>
            </div>
            <p className="form-intro">Share a few details and the SurfSync team can follow up with you. Fields marked * are required.</p>
            <div className="form-grid">
              <label>Name *<input name="name" autoComplete="name" required maxLength={100} placeholder="Your name" />{leadErrors.name && <small className="field-error">{leadErrors.name}</small>}</label>
              <label>Email *<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />{leadErrors.email && <small className="field-error">{leadErrors.email}</small>}</label>
              <label>Phone <span className="optional">(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="+91 98765 43210" />{leadErrors.phone && <small className="field-error">{leadErrors.phone}</small>}</label>
              <label>Service you're interested in *
                <select name="service" required value={selectedService} onChange={(event) => setSelectedService(event.target.value as Service | "")}>
                  <option value="">Choose a service</option>
                  {services.map((service) => <option key={service} value={service}>{service}</option>)}
                </select>
                {leadErrors.service && <small className="field-error">{leadErrors.service}</small>}
              </label>
              <label className="full-width">Brief project description *
                <textarea name="description" required minLength={10} maxLength={2000} rows={3} placeholder="What would you like to build or improve?" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} />
                {leadErrors.description && <small className="field-error">{leadErrors.description}</small>}
              </label>
              <label>Estimated budget <span className="optional">(optional)</span>
                <select name="budget"><option value="">Prefer not to say</option><option>Under ₹50,000</option><option>₹50,000 – ₹2,00,000</option><option>₹2,00,000 – ₹5,00,000</option><option>₹5,00,000+</option><option>Need guidance</option></select>
              </label>
              <label>Expected timeline <span className="optional">(optional)</span>
                <select name="timeline"><option value="">Not decided</option><option>As soon as possible</option><option>Within 1 month</option><option>1–3 months</option><option>3+ months</option><option>Flexible</option></select>
              </label>
            </div>
            <label className="consent-row"><input name="consent" type="checkbox" required /><span>I agree that SurfSync Infotech may use these details to respond to my project enquiry. My information will be stored to handle this request.</span></label>
            {leadErrors.consent && <small className="field-error consent-error">{leadErrors.consent}</small>}
            <div className={`form-status ${leadStatusIsError ? "error" : ""}`} role="status" aria-live="polite">{leadStatus}</div>
            <div className="form-actions">
              <button className="cancel-button" type="button" onClick={closeLeadForm}>Cancel</button>
              <button className="submit-button" type="submit" disabled={isSubmittingLead}>{isSubmittingLead ? "Sending..." : <>Send enquiry <span aria-hidden="true">→</span></>}</button>
            </div>
            <p className="privacy-note">Your enquiry is stored securely to handle your request. Or email <a href="mailto:info@surfsyncinfotech.in">info@surfsyncinfotech.in</a> directly.</p>
          </form>
        )}
      </dialog>
    </section>
  );
}
