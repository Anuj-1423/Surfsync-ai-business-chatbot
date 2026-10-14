const chatForm = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message-input");
const messagesElement = document.querySelector("#messages");
const sendButton = document.querySelector("#send-button");
const suggestionsElement = document.querySelector("#suggestions");
const leadDialog = document.querySelector("#lead-dialog");
const leadForm = document.querySelector("#lead-form");
const leadSubmitButton = document.querySelector("#lead-submit-button");
const formStatus = document.querySelector("#form-status");
const history = [];

function timestamp() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function appendMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  const avatar = document.createElement("div");
  avatar.className = role === "user" ? "message-avatar user-avatar" : "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "Y" : "S";
  const content = document.createElement("div");
  content.className = "message-content";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  const time = document.createElement("time");
  time.textContent = timestamp();
  content.append(paragraph, time);
  article.append(avatar, content);
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function showTyping() {
  const article = document.createElement("article");
  article.className = "message assistant-message";
  article.id = "typing-indicator";
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "S";
  avatar.setAttribute("aria-hidden", "true");
  const dots = document.createElement("div");
  dots.className = "typing";
  dots.setAttribute("aria-label", "Assistant is typing");
  dots.innerHTML = "<span></span><span></span><span></span>";
  article.append(avatar, dots);
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

async function sendMessage(rawText) {
  const text = rawText.trim();
  if (!text || sendButton.disabled) return;
  appendMessage("user", text);
  history.push({ role: "user", content: text });
  messageInput.value = "";
  messageInput.style.height = "auto";
  sendButton.disabled = true;
  showTyping();
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-10) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not get a response.");
    appendMessage("assistant", data.reply);
    history.push({ role: "assistant", content: data.reply });
  } catch (error) {
    appendMessage("assistant", `${error.message} You can also reach the team at info@surfsyncinfotech.in.`);
    history.pop();
  } finally {
    document.querySelector("#typing-indicator")?.remove();
    sendButton.disabled = false;
    messageInput.focus();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendMessage(messageInput.value);
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 92)}px`;
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

suggestionsElement.addEventListener("click", (event) => {
  const button = event.target.closest(".suggestion");
  if (button) void sendMessage(button.textContent);
});

document.querySelector("#restart-button").addEventListener("click", () => {
  history.length = 0;
  messagesElement.replaceChildren();
  appendMessage("assistant", "Hi there! I'm SurfSync's virtual assistant. I can help you explore our services, products, and the work we share on our website. What would you like to know?");
  messageInput.value = "";
  messageInput.focus();
});

function openLeadForm() {
  leadForm.reset();
  formStatus.textContent = "";
  formStatus.classList.remove("error");
  leadForm.querySelectorAll(".field-error").forEach((element) => { element.textContent = ""; });
  leadDialog.showModal();
}

document.querySelector("#lead-open-button").addEventListener("click", openLeadForm);
document.querySelector("#lead-close-button").addEventListener("click", () => leadDialog.close());
document.querySelector("#lead-cancel-button").addEventListener("click", () => leadDialog.close());
leadDialog.addEventListener("click", (event) => {
  if (event.target === leadDialog) leadDialog.close();
});

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "";
  formStatus.classList.remove("error");
  leadForm.querySelectorAll(".field-error").forEach((element) => { element.textContent = ""; });
  const data = Object.fromEntries(new FormData(leadForm));
  data.consent = leadForm.elements.consent.checked;
  leadSubmitButton.disabled = true;
  leadSubmitButton.textContent = "Sending...";
  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok && result.fields) {
      for (const [field, message] of Object.entries(result.fields)) {
        const target = leadForm.querySelector(`[data-error="${field}"]`);
        if (target) target.textContent = message;
      }
      throw new Error(result.error || "Please review the form.");
    }
    if (!response.ok) throw new Error(result.error || "Your enquiry could not be sent.");
    formStatus.textContent = `Thank you! Your enquiry has been saved. Reference #${result.reference}. You can also reach the team at info@surfsyncinfotech.in.`;
    leadForm.reset();
  } catch (error) {
    formStatus.textContent = error.message;
    formStatus.classList.add("error");
  } finally {
    leadSubmitButton.disabled = false;
    leadSubmitButton.innerHTML = 'Send enquiry <span aria-hidden="true">→</span>';
  }
});
