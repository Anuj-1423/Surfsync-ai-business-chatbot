import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export type TeamAgent = { userId: string; name: string };
export type Customer = { userId: string; name: string; email: string };

export function hashVisitorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;
  return authData.user;
}

export async function getTeamAgent(request: Request): Promise<TeamAgent | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;
  const supabase = getSupabaseAdmin();

  const { data: agent, error } = await supabase
    .from("team_agents")
    .select("user_id, display_name")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (error || !agent) return null;
  return { userId: agent.user_id, name: agent.display_name };
}

export async function getCustomer(request: Request): Promise<Customer | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;
  const supabase = getSupabaseAdmin();
  const [{ data: agent, error: agentError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("team_agents").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("customer_profiles").select("full_name").eq("user_id", user.id).maybeSingle()
  ]);
  if (agentError || profileError || agent || !profile) return null;
  return { userId: user.id, name: profile.full_name, email: user.email ?? "" };
}

export function getVisitorToken(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("visitorToken") ?? "";
}

export function isValidVisitorToken(token: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
}

export function asMessage(body: unknown): body is Record<string, unknown> & { text: string } {
  return typeof body === "object" && body !== null &&
    "text" in body && typeof body.text === "string" &&
    body.text.trim().length > 0 && body.text.length <= 2000;
}

export function getAdmin() {
  return getSupabaseAdmin();
}
