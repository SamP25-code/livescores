import { generatePassword } from "@/lib/password";
import { canAssign, canResetPassword, toStaffUser, type StaffAssignment } from "@/lib/staffUsers";
import { jsonError, requireStaff, type Staff } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function loadTarget(auth: Staff, id: string) {
  const [{ data, error }, { data: assignments }] = await Promise.all([
    auth.admin.auth.admin.getUserById(id),
    auth.admin.from("assignments").select("competition_id, role").eq("user_id", id),
  ]);
  if (error || !data.user) return null;
  return toStaffUser(data.user, (assignments ?? []) as StaffAssignment[]);
}

// Gives a login a new generated password (sent back once to pass on).
// Body: { newPassword: true }. Super can for anyone; an admin only for
// someone who just scores in their competitions.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (body?.newPassword !== true) return jsonError(400, "Nothing to change.");

  const target = await loadTarget(auth, id);
  if (!target) return jsonError(404, "That login no longer exists.");
  if (!canResetPassword(target, { id: auth.caller.id, isSuper: auth.isSuper, adminOf: auth.adminOf })) {
    return jsonError(403, "Only Super can give them a new password.");
  }
  const password = generatePassword();
  const { error } = await auth.admin.auth.admin.updateUserById(id, { password });
  if (error) return jsonError(400, error.message);
  return Response.json({ password });
}

// ?competition=<id>: takes them off that competition (an admin can only take
// off scorers in competitions they run). Without it: removes the login
// altogether - Super only.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const competitionId = new URL(request.url).searchParams.get("competition");

  if (competitionId) {
    const { data: current } = await auth.admin
      .from("assignments")
      .select("role")
      .eq("user_id", id)
      .eq("competition_id", competitionId)
      .maybeSingle();
    if (!current) return Response.json({ ok: true });
    if (!canAssign(competitionId, current.role, auth)) {
      return jsonError(403, "Only Super can take an admin off a competition.");
    }
    const { error } = await auth.admin.from("assignments").delete().eq("user_id", id).eq("competition_id", competitionId);
    if (error) return jsonError(400, error.message);
    await auth.admin.from("audit_log").insert({
      competition_id: competitionId,
      user_id: auth.caller.id,
      action: "unassigned",
      details: { unassigned_user_id: id, role: current.role },
    });
    return Response.json({ ok: true });
  }

  if (!auth.isSuper) return jsonError(403, "Only Super can remove a login.");
  if (id === auth.caller.id) return jsonError(400, "You can't remove your own login.");
  const { error } = await auth.admin.auth.admin.deleteUser(id);
  if (error) return jsonError(400, error.message);
  return Response.json({ ok: true });
}
