// Supabase logins always need an email address, but admins and scorers here
// sign in with their full name instead. A name is turned into a stand-in
// address nobody ever sees or receives mail at - "Sam Patterson" becomes
// "sam.patterson@names.pssc-bowls.example.com" - and that's the address the
// account is created with in Supabase. Anything typed with an "@" is used as
// a real email address, so email logins keep working too.
export const NAME_LOGIN_DOMAIN = "names.pssc-bowls.example.com";

export function isNameLogin(input: string): boolean {
  return !input.includes("@");
}

// The address to sign in with, or null if nothing usable was typed.
// Case, accents, spacing and punctuation don't matter: "  sam  PATTERSON ",
// "Sam Patterson" and "Sam-Patterson" all give the same login, so people
// don't get locked out over how they typed their name.
export function loginEmailFor(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!isNameLogin(trimmed)) return trimmed;
  const slug = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return slug ? `${slug}@${NAME_LOGIN_DOMAIN}` : null;
}
