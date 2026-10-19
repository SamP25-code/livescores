// SERVER ONLY - never import this from a page or component. It uses the
// service role key, which can do anything in the project, so it must only
// ever run in an API route on the server.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function jsonError(status: number, error: string, code?: string) {
  return Response.json({ error, code }, { status });
}

export type Staff = {
  admin: SupabaseClient;
  caller: User;
  isSuper: boolean;
  // Competitions the caller is an admin of (every one, for Super)
  adminOf: Set<string>;
};

// Checks the request comes from Super or an admin of at least one
// competition, using the access token the page sends. Returns the admin
// client, the caller and what they run, or a ready-made error response.
export async function requireStaff(request: Request): Promise<Staff | { response: Response }> {
  const admin = supabaseAdmin();
  if (!admin) {
    return {
      response: jsonError(
        500,
        "Managing logins here needs SUPABASE_SERVICE_ROLE_KEY set in Vercel.",
        "not_configured"
      ),
    };
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { response: jsonError(401, "Please sign in again.") };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { response: jsonError(401, "Please sign in again.") };

  const isSuper = data.user.app_metadata?.role === "super";
  let adminOf: string[];
  if (isSuper) {
    const { data: all } = await admin.from("competitions").select("id");
    adminOf = (all ?? []).map((c) => c.id);
  } else {
    const { data: mine } = await admin
      .from("assignments")
      .select("competition_id")
      .eq("user_id", data.user.id)
      .eq("role", "admin");
    adminOf = (mine ?? []).map((a) => a.competition_id);
  }
  if (!isSuper && adminOf.length === 0) {
    return { response: jsonError(403, "Only Super or a competition's admin can manage logins.") };
  }
  return { admin, caller: data.user, isSuper, adminOf: new Set(adminOf) };
}

// A login given a generated password (new, or "New password" on the Users
// page) is asked to choose its own the first time it signs in. This mark on
// the login says so; it's cleared once they have.
export const MUST_CHOOSE_PASSWORD = "must_choose_password";

// Checks the request comes from any signed-in login (for things people do to
// their own login). Returns the admin client and the caller.
export async function requireSignedIn(
  request: Request
): Promise<{ admin: SupabaseClient; caller: User } | { response: Response }> {
  const admin = supabaseAdmin();
  if (!admin) return { response: jsonError(500, "SUPABASE_SERVICE_ROLE_KEY isn't set.", "not_configured") };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { response: jsonError(401, "Please sign in again.") };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { response: jsonError(401, "Please sign in again.") };
  return { admin, caller: data.user };
}
