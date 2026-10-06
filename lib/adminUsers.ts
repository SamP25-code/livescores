import type { User } from "@supabase/supabase-js";
import { NAME_LOGIN_DOMAIN } from "@/lib/loginName";
import type { AdminRole } from "@/lib/auth";

// A login as shown on the admin's "Admins and scorers" list.
export type AdminUser = {
  id: string;
  name: string;
  // The real email address, or null for a name login (its stand-in
  // address is never shown).
  email: string | null;
  role: AdminRole;
  lastSignInAt: string | null;
};

export function roleOf(user: Pick<User, "app_metadata">): AdminRole {
  return user.app_metadata?.role === "scorer" ? "scorer" : "owner";
}

export function isStandInEmail(email: string | undefined): boolean {
  return Boolean(email?.endsWith(`@${NAME_LOGIN_DOMAIN}`));
}

// The full name typed when the login was added here; failing that, a name
// rebuilt from a stand-in address ("wayne.ditchfield@..." -> "Wayne
// Ditchfield"); failing that, the email address itself.
export function displayNameOf(user: Pick<User, "email" | "user_metadata">): string {
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (user.email && isStandInEmail(user.email)) {
    return user.email
      .split("@")[0]
      .split(".")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return user.email ?? "Unknown";
}

export function toAdminUser(user: User): AdminUser {
  return {
    id: user.id,
    name: displayNameOf(user),
    email: isStandInEmail(user.email) ? null : user.email ?? null,
    role: roleOf(user),
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}
