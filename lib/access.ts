"use client";

// Who can do what, for the signed-in login:
//   - Super (Sam): everything, everywhere
//   - Admin of a competition: runs it - entries, draws, results, scorers
//   - Scorer of a competition: scores its matches once the draw is published
// Admin and Scorer come from the login's assignments, one per competition,
// so someone can be an admin on one and a scorer on another. The database's
// own rules check the same assignments; this just decides what to show.
//
// Nights not in a competition (before the 2027 move) fall back to the old
// owner / scorer mark on the login.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type CompetitionRole = "admin" | "scorer";
// What a page offers: "owner" runs it, "scorer" only scores
export type PageRole = "owner" | "scorer";

export type Access = {
  userId: string;
  isSuper: boolean;
  // competition id -> role
  roles: Map<string, CompetitionRole>;
  // The old mark on the login, for nights not in a competition
  legacyRole: PageRole;
};

// How this login works on a page about one competition (or an old night
// with none). null: not theirs.
export function pageRoleFor(access: Access, competitionId: string | null | undefined): PageRole | null {
  if (access.isSuper) return "owner";
  if (!competitionId) return access.legacyRole;
  const role = access.roles.get(competitionId);
  return role === "admin" ? "owner" : role === "scorer" ? "scorer" : null;
}

// Admin of at least one competition (or Super)
export function isAnyAdmin(access: Access): boolean {
  return access.isSuper || [...access.roles.values()].includes("admin");
}

// The label beside their name in the menu
export function accessLabel(access: Access): string {
  if (access.isSuper) return "Super";
  if (isAnyAdmin(access)) return "Admin";
  if (access.roles.size > 0) return "Scorer";
  return access.legacyRole === "scorer" ? "Scorer" : "Admin";
}

// Competitions this login can see on the admin side
export function visibleCompetition(access: Access, competitionId: string): boolean {
  return access.isSuper || access.roles.has(competitionId);
}

// One lookup per sign-in, shared by every component that asks
let cached: { userId: string; promise: Promise<Access> } | null = null;

async function loadAccess(userId: string, appRole: unknown): Promise<Access> {
  const roles = new Map<string, CompetitionRole>();
  const { data, error } = await supabase.from("assignments").select("competition_id, role").eq("user_id", userId);
  // No assignments table yet (a database not moved to 2027): old marks only
  if (!error) for (const a of data ?? []) roles.set(a.competition_id, a.role);
  return {
    userId,
    isSuper: appRole === "super",
    roles,
    legacyRole: appRole === "scorer" ? "scorer" : "owner",
  };
}

// The signed-in login's access; null while loading or signed out
export function useAccess(): Access | null {
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    let cancelled = false;
    function apply(user: { id: string; app_metadata?: Record<string, unknown> } | undefined) {
      if (!user) {
        cached = null;
        if (!cancelled) setAccess(null);
        return;
      }
      if (!cached || cached.userId !== user.id) {
        cached = { userId: user.id, promise: loadAccess(user.id, user.app_metadata?.role) };
      }
      cached.promise.then((a) => {
        if (!cancelled) setAccess(a);
      });
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return access;
}

// After this login's own assignments change (rare - e.g. Super assigning
// themselves), look them up again next time
export function forgetAccess() {
  cached = null;
}
