import { toAdminUser } from "@/lib/adminUsers";
import { generatePassword } from "@/lib/password";
import { jsonError, requireOwner } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Changes a login's role, or gives it a new generated password (sent back
// once to pass on). Body: { role } or { newPassword: true }.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);

  if (body?.role === "owner" || body?.role === "scorer") {
    // Stops an admin locking themselves out of this page.
    if (params.id === auth.caller.id && body.role === "scorer") {
      return jsonError(400, "You can't make yourself a scorer - another admin would need to do that.");
    }
    // A null role is removed rather than stored, leaving a full admin.
    const { data, error } = await auth.admin.auth.admin.updateUserById(params.id, {
      app_metadata: { role: body.role === "scorer" ? "scorer" : null },
    });
    if (error) return jsonError(400, error.message);
    return Response.json({ user: toAdminUser(data.user) });
  }

  if (body?.newPassword === true) {
    const password = generatePassword();
    const { data, error } = await auth.admin.auth.admin.updateUserById(params.id, { password });
    if (error) return jsonError(400, error.message);
    return Response.json({ user: toAdminUser(data.user), password });
  }

  return jsonError(400, "Nothing to change.");
}

// Removes a login.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;

  if (params.id === auth.caller.id) {
    return jsonError(400, "You can't remove your own login - another admin would need to do that.");
  }
  const { error } = await auth.admin.auth.admin.deleteUser(params.id);
  if (error) return jsonError(400, error.message);
  return Response.json({ ok: true });
}
