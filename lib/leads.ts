import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { LeadInput } from "@/lib/validation";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export type SavedLead = { id: string; duplicate: boolean };

async function saveToDevelopmentSqlite(lead: LeadInput): Promise<SavedLead> {
  const { DatabaseSync } = await import("node:sqlite");
  const databasePath = join(process.cwd(), "data", "leads.sqlite");
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  try {
    const createTableSql = `
      CREATE TABLE leads (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        service TEXT NOT NULL,
        description TEXT NOT NULL,
        budget TEXT,
        timeline TEXT,
        consent_given INTEGER NOT NULL CHECK (consent_given = 1),
        consent_timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `;
    const existingTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'leads'").get();
    if (!existingTable) {
      db.exec(createTableSql);
    } else {
      const columns = db.prepare("PRAGMA table_info(leads)").all() as { name: string }[];
      const columnNames = new Set(columns.map((column) => column.name));
      if (!columnNames.has("submission_id")) {
        if (!columnNames.has("project_description") || !columnNames.has("consent")) {
          throw new Error("The existing local leads table has an unsupported schema.");
        }
        db.exec("BEGIN IMMEDIATE");
        try {
          db.exec("ALTER TABLE leads RENAME TO leads_legacy");
          db.exec(createTableSql);
          db.exec(`
            INSERT INTO leads (id, submission_id, name, email, phone, service, description, budget, timeline, consent_given, consent_timestamp, created_at)
            SELECT CAST(id AS TEXT), 'legacy-' || CAST(id AS TEXT), name, email, phone, service, project_description, budget, timeline, consent, created_at, created_at
            FROM leads_legacy;
            DROP TABLE leads_legacy;
            COMMIT;
          `);
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      }
    }
    const inserted = db.prepare(`
      INSERT INTO leads (id, submission_id, name, email, phone, service, description, budget, timeline, consent_given, consent_timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(submission_id) DO NOTHING
    `).run(
      randomUUID(),
      lead.submissionId,
      lead.name,
      lead.email,
      lead.phone ?? null,
      lead.service,
      lead.description,
      lead.budget || null,
      lead.timeline || null,
      new Date().toISOString(),
      new Date().toISOString()
    );
    const saved = db.prepare("SELECT id FROM leads WHERE submission_id = ?").get(lead.submissionId) as { id: string } | undefined;
    if (!saved) throw new Error("Unable to save the lead.");
    return { id: saved.id, duplicate: inserted.changes === 0 };
  } finally {
    db.close();
  }
}

export async function saveLead(lead: LeadInput): Promise<SavedLead> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Lead storage is not configured.");
    }
    return saveToDevelopmentSqlite(lead);
  }

  const supabase = getSupabaseAdmin();
  const payload = {
    submission_id: lead.submissionId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone || null,
    service: lead.service,
    description: lead.description,
    budget: lead.budget || null,
    timeline: lead.timeline || null,
    consent_given: lead.consent,
    consent_timestamp: new Date().toISOString()
  };
  const { data, error } = await supabase.from("leads").insert(payload).select("id").single();
  if (!error && data) return { id: data.id, duplicate: false };
  if (error?.code === "23505") {
    const { data: existing, error: lookupError } = await supabase
      .from("leads")
      .select("id")
      .eq("submission_id", lead.submissionId)
      .single();
    if (!lookupError && existing) return { id: existing.id, duplicate: true };
  }
  throw new Error("Lead storage is temporarily unavailable.");
}
