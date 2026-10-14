/**
 * Server-side Supabase helpers.
 * Service-role key (if used) must only be read inside handlers, never at module scope
 * and never exposed to the client.
 *
 * For the no-login model we primarily use the publishable key + server-side
 * session filtering. Service role is optional and only for admin migrations.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getServerSupabase(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
