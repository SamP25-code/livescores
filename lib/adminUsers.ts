import type { User } from "@supabase/supabase-js";
import { NAME_LOGIN_DOMAIN } from "@/lib/loginName";

// Names for logins, as shown on the Users page and in the admin menu.
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
