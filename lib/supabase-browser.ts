"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const clients = new Map<string, SupabaseClient>();

export function getBrowserSupabase(role: "customer" | "team") {
  if (!supabaseUrl || !supabasePublishableKey) return null;
  const storageKey = `surfsync-${role}-auth`;
  let client = clients.get(storageKey);
  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey, { auth: { storageKey, autoRefreshToken: true, persistSession: true } });
    clients.set(storageKey, client);
  }
  return client;
}
