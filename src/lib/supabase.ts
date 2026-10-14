/**
 * Browser-side Supabase client (publishable / anon key only).
 * Never put the service-role key here.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase =
  isSupabaseConfigured
    ? createClient(supabaseUrl!, supabaseAnonKey!)
    : null;
