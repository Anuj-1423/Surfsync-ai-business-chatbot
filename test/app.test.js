import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const testDirectory = await mkdtemp(join(tmpdir(), "surfsync-chatbot-"));
process.env.DATABASE_PATH = join(testDirectory, "leads.sqlite");
delete process.env.OPENAI_API_KEY;

const { createAppServer, closeDatabase } = await import("../server.js");
const server = createAppServer();
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  await rm(testDirectory, { recursive: true, force: true });
});

async function post(path, payload) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

test("serves the chat page and health status without exposing a provider key", async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.deepEqual(health, { status: "ok", aiConfigured: false });
});

test("uses verified business facts and declines to invent pricing", async () => {
  const response = await post("/api/chat", {
    messages: [{ role: "user", content: "What is your pricing?" }]
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.match(result.reply, /hasn't published pricing/i);
  assert.match(result.reply, /info@surfsyncinfotech\.in/);
});

test("answers known service questions with website-supported details", async () => {
  const response = await post("/api/chat", {
    messages: [{ role: "user", content: "Tell me about mobile development" }]
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.match(result.reply, /React Native and Flutter/);
});

test("uses prior turns to answer contextual follow-up questions without an AI key", async () => {
  const response = await post("/api/chat", {
    messages: [
      { role: "user", content: "I need a mobile app" },
      { role: "assistant", content: "What kind of app are you planning?" },
      { role: "user", content: "Does it support both?" }
    ]
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.match(result.reply, /React Native and Flutter/);
});

test("returns a graceful answer for unsupported questions", async () => {
  const response = await post("/api/chat", {
    messages: [{ role: "user", content: "What is the CEO's favorite food?" }]
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.match(result.reply, /don't have verified information/i);
});

test("rejects malformed or oversized chat inputs", async () => {
  const empty = await post("/api/chat", { messages: [] });
  assert.equal(empty.status, 400);
  const oversized = await post("/api/chat", {
    messages: [{ role: "user", content: "a".repeat(2001) }]
  });
  assert.equal(oversized.status, 400);
});

test("requires consent and validates lead fields", async () => {
  const missingConsent = await post("/api/leads", {
    name: "Asha Rao",
    email: "asha@example.com",
    service: "Web Development",
    description: "A business website for my company",
    consent: false
  });
  assert.equal(missingConsent.status, 400);
  const invalidEmail = await post("/api/leads", {
    name: "Asha Rao",
    email: "invalid",
    service: "Web Development",
    description: "A business website for my company",
    consent: true
  });
  assert.equal(invalidEmail.status, 400);
});

test("stores a consented valid lead in SQLite and returns a reference", async () => {
  const response = await post("/api/leads", {
    name: "Asha Rao",
    email: "asha@example.com",
    phone: "+91 98765 43210",
    service: "Web Development",
    description: "A business website for my company",
    budget: "Need guidance",
    timeline: "1–3 months",
    consent: true
  });
  const result = await response.json();
  assert.equal(response.status, 201);
  assert.equal(result.success, true);
  assert.equal(typeof result.reference, "number");
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(process.env.DATABASE_PATH);
  const storedLead = database.prepare("SELECT name, email, consent FROM leads WHERE id = ?").get(result.reference);
  database.close();
  assert.deepEqual({ ...storedLead }, { name: "Asha Rao", email: "asha@example.com", consent: 1 });
});
