// SERVER ONLY - never import this from a page or component. It uses the
// service role key, which can do anything in the project, so it must only
// ever run in an API route on the server.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { roleOf } from "@/lib/adminUsers";

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function jsonError(status: number, error: string, code?: string) {
  return Response.json({ error, code }, { status });
}

// Checks the request comes from a signed-in full admin (not a scorer), using
// the access token the admin page sends. Returns the admin client and the
// caller, or a ready-made error response.
export async function requireOwner(
  request: Request
): Promise<{ admin: SupabaseClient; caller: User } | { response: Response }> {
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
  if (roleOf(data.user) !== "owner") {
    return { response: jsonError(403, "Only a full admin can manage logins.") };
  }
  return { admin, caller: data.user };
}
