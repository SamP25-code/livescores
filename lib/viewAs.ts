"use client";

// Super's "View as": sign in as an admin or scorer in this browser tab to see
// exactly what they see, then go back. Super's own sign-in is kept in the
// tab (sessionStorage - this tab only, gone when it's closed) to return to.

import { supabase } from "@/lib/supabaseClient";
import { forgetAccess } from "@/lib/access";

const KEY = "bowls-view-as";

type Stored = { name: string; accessToken: string; refreshToken: string };

function read(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

// Who Super is viewing as in this tab, if anyone
export function viewingAs(): string | null {
  return read()?.name ?? null;
}

export async function startViewingAs(userId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const own = data.session;
  if (!own) throw new Error("Please sign in again.");

  const response = await fetch(`/api/admin/users/${userId}/view-as`, {
    method: "POST",
    headers: { Authorization: `Bearer ${own.access_token}` },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? "Couldn't sign in as them.");

  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ name: json.name, accessToken: own.access_token, refreshToken: own.refresh_token })
    );
  } catch {
    throw new Error("This browser won't keep your own sign-in to come back to (private browsing?).");
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: json.tokenHash, type: "magiclink" });
  if (error) {
    sessionStorage.removeItem(KEY);
    throw error;
  }
  forgetAccess();
  // A fresh start, so every page and menu reads their access
  window.location.href = "/admin";
}

export async function backToOwnLogin(): Promise<void> {
  const stored = read();
  sessionStorage.removeItem(KEY);
  if (stored) {
    const { error } = await supabase.auth.setSession({
      access_token: stored.accessToken,
      refresh_token: stored.refreshToken,
    });
    if (error) {
      // Couldn't get back in (e.g. away a long time): sign in again
      await supabase.auth.signOut({ scope: "local" });
      window.location.href = "/admin/login";
      return;
    }
  }
  forgetAccess();
  window.location.href = "/admin/users";
}

// Signing out while viewing as someone: forget the way back too
export function clearViewAs() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing kept
  }
}
