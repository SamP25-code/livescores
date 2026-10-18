// Logins as the Users page shows them: who they are, and which competitions
// they're an admin or scorer of. Shared by the API routes and the page.
import type { User } from "@supabase/supabase-js";
import { displayNameOf, isStandInEmail } from "@/lib/adminUsers";

export type StaffAssignment = { competition_id: string; role: "admin" | "scorer" };

export type StaffUser = {
  id: string;
  name: string;
  // The real email address, or null for a name login
  email: string | null;
  isSuper: boolean;
  lastSignInAt: string | null;
  assignments: StaffAssignment[];
};

export type CompetitionChoice = { id: string; title: string };

export function toStaffUser(user: User, assignments: StaffAssignment[]): StaffUser {
  return {
    id: user.id,
    name: displayNameOf(user),
    email: isStandInEmail(user.email) ? null : user.email ?? null,
    isSuper: user.app_metadata?.role === "super",
    lastSignInAt: user.last_sign_in_at ?? null,
    assignments,
  };
}

// What an admin (not Super) may see of a login: only its assignments in
// competitions they run. A login with none of those isn't shown to them.
export function visibleTo(
  user: StaffUser,
  viewer: { id: string; isSuper: boolean; adminOf: Set<string> }
): StaffUser | null {
  if (viewer.isSuper) return user;
  const shared = user.assignments.filter((a) => viewer.adminOf.has(a.competition_id));
  if (shared.length === 0 && user.id !== viewer.id) return null;
  return { ...user, assignments: shared };
}

// Whether the viewer can give this login a new password: Super can for
// anyone; an admin only for someone who just scores in their competitions
// (not another admin, and not Super).
export function canResetPassword(
  target: { id: string; isSuper: boolean; assignments: StaffAssignment[] },
  viewer: { id: string; isSuper: boolean; adminOf: Set<string> }
): boolean {
  if (viewer.isSuper || target.id === viewer.id) return true;
  if (target.isSuper || target.assignments.length === 0) return false;
  return target.assignments.every((a) => a.role === "scorer" && viewer.adminOf.has(a.competition_id));
}

// Whether the viewer can add or remove this role in this competition:
// Super anything; an admin only scorers, only in competitions they run.
export function canAssign(
  competitionId: string,
  role: "admin" | "scorer",
  viewer: { isSuper: boolean; adminOf: Set<string> }
): boolean {
  if (viewer.isSuper) return true;
  return role === "scorer" && viewer.adminOf.has(competitionId);
}
