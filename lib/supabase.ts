import "server-only";
import { createClient } from "@supabase/supabase-js";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseSecretKey());
}

export function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) {
    throw new Error("Supabase server credentials are not configured.");
  }
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
