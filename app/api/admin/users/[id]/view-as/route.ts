import { jsonError, requireStaff } from "@/lib/supabaseAdmin";
import { displayNameOf } from "@/lib/adminUsers";

export const dynamic = "force-dynamic";

// Super: sign in as another login to see exactly what they see. Returns a
// one-time sign-in code for that login (nothing is emailed); the page uses
// it, keeping Super's own sign-in in that tab to go back to. Never for
// another Super, and every use is logged.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;
  if (!auth.isSuper) return jsonError(403, "Only Super can view as someone else.");
  const { id } = await params;
  if (id === auth.caller.id) return jsonError(400, "That's you already.");

  const { data, error } = await auth.admin.auth.admin.getUserById(id);
  if (error || !data.user) return jsonError(404, "That login no longer exists.");
  const target = data.user;
  if (target.app_metadata?.role === "super") return jsonError(403, "You can't view as another Super.");
  if (!target.email) return jsonError(400, "That login has no sign-in address.");

  const { data: link, error: linkError } = await auth.admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
  });
  if (linkError || !link.properties?.hashed_token) {
    return jsonError(400, linkError?.message ?? "Couldn't sign in as them.");
  }

  await auth.admin.from("audit_log").insert({
    competition_id: null,
    user_id: auth.caller.id,
    action: "viewed_as",
    details: { viewed_user_id: id, name: displayNameOf(target) },
  });

  return Response.json({ tokenHash: link.properties.hashed_token, name: displayNameOf(target) });
}
