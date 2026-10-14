"use client";

import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const clients = new Map<string, SupabaseClient>();
const tabIdStorageKey = "surfsync-auth-tab-id";
let inMemoryTabId: string | undefined;

function getTabId() {
  if (inMemoryTabId) return inMemoryTabId;

  try {
    inMemoryTabId = window.sessionStorage.getItem(tabIdStorageKey) ?? undefined;
    if (!inMemoryTabId) {
      inMemoryTabId = crypto.randomUUID();
      window.sessionStorage.setItem(tabIdStorageKey, inMemoryTabId);
    }
  } catch {
    // Keep auth usable when browser storage is disabled; the session will then
    // last only for the lifetime of this page.
    inMemoryTabId = crypto.randomUUID();
  }

  return inMemoryTabId;
}

function createTabStorage(): SupportedStorage {
  const memory = new Map<string, string>();
  return {
    getItem(key) {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
    },
    removeItem(key) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        memory.delete(key);
      }
    }
  };
}

export function getBrowserSupabase(role: "customer" | "team") {
  if (!supabaseUrl || !supabasePublishableKey) return null;

  // During server rendering this client is never used for auth. Don't cache it
  // across requests or share its storage with a browser tab.
  if (typeof window === "undefined") {
    return createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  // Each browser tab gets its own sessionStorage namespace and BroadcastChannel.
  // This keeps sign-in/sign-out local to that tab, while chats and queries still
  // live in the shared Supabase database.
  const storageKey = `surfsync-${role}-${getTabId()}-auth`;
  let client = clients.get(storageKey);
  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storageKey,
        storage: createTabStorage(),
        autoRefreshToken: true,
        persistSession: true
      }
    });
    clients.set(storageKey, client);
  }
  return client;
}
