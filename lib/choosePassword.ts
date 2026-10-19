"use client";

import { supabase } from "@/lib/supabaseClient";

// The mark on a login that was given a generated password - set on the
// server (lib/supabaseAdmin.ts), cleared once they choose their own
export const MUST_CHOOSE_PASSWORD = "must_choose_password";

export function mustChoosePassword(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return Boolean(user?.app_metadata?.[MUST_CHOOSE_PASSWORD]);
}

// Problems with a new password before it's saved
export function newPasswordProblem(password: string, again: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password !== again) return "The two passwords don't match.";
  return null;
}

// Saves the login's own new password, then clears the "choose your own"
// mark and refreshes the sign-in so it takes effect straight away
export async function saveOwnPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  const { data } = await supabase.auth.getSession();
  const response = await fetch("/api/admin/password-chosen", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error ?? "Your password was saved, but something went wrong - try signing in again.");
  }
  await supabase.auth.refreshSession();
}
