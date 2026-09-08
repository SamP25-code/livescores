import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether real Supabase credentials are configured for this build. Checked
 * by the root layout to show an on-page warning - a missing/misconfigured
 * env var should be obvious to whoever's looking at the site, not just a
 * console.warn buried in devtools.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Warned rather than thrown: createClient() throws immediately on an
  // empty URL, which would crash this module the moment anything imports
  // it - including Next's build-time page analysis, taking the whole build
  // down over a missing .env.local (or an environment not configured in
  // Vercel yet) instead of just this one page failing at runtime.
  console.warn(
    "Supabase env vars are missing. Copy .env.local.example to .env.local and fill in your project's URL and anon key."
  );
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key");
