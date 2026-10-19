import { isNameLogin, loginEmailFor } from "@/lib/loginName";
import { generatePassword } from "@/lib/password";
import { canAssign, toStaffUser, visibleTo, type CompetitionChoice, type StaffAssignment } from "@/lib/staffUsers";
import { MUST_CHOOSE_PASSWORD, jsonError, requireStaff } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Everyone who can sign in (for Super), or the people in the caller's own
// competitions (for an admin), with their assignments; plus the competitions
// the caller can assign people to.
export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;

  const [{ data, error }, { data: assignments, error: assignmentsError }, { data: comps, error: compsError }] =
    await Promise.all([
      auth.admin.auth.admin.listUsers({ perPage: 1000 }),
      auth.admin.from("assignments").select("user_id, competition_id, role"),
      auth.admin
        .from("competitions")
        .select("id, year, status, series:series_id(name)")
        .order("year", { ascending: false }),
    ]);
  if (error) return jsonError(500, error.message);
  if (assignmentsError) return jsonError(500, assignmentsError.message);
  if (compsError) return jsonError(500, compsError.message);

  const byUser = new Map<string, StaffAssignment[]>();
  for (const a of assignments ?? []) {
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
    byUser.get(a.user_id)!.push({ competition_id: a.competition_id, role: a.role });
  }
  const viewer = { id: auth.caller.id, isSuper: auth.isSuper, adminOf: auth.adminOf };
  const users = data.users
    .map((u) => visibleTo(toStaffUser(u, byUser.get(u.id) ?? []), viewer))
    .filter((u): u is NonNullable<typeof u> => u !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const competitions: CompetitionChoice[] = (comps ?? [])
    .filter((c) => auth.adminOf.has(c.id))
    .map((c) => ({
      id: c.id,
      title: `${(c.series as unknown as { name: string } | null)?.name ?? "Competition"} ${c.year}`,
    }));

  return Response.json({ users, competitions, callerId: auth.caller.id, isSuper: auth.isSuper });
}

// Adds someone to a competition as an admin or scorer. If they don't have a
// login yet, one is made with a generated password, sent back once so it can
// be passed on. Body: { login: full name or email, competitionId, role }.
export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const login = typeof body?.login === "string" ? body.login.trim().replace(/\s+/g, " ") : "";
  const competitionId = typeof body?.competitionId === "string" ? body.competitionId : "";
  const role = body?.role === "admin" ? "admin" : "scorer";

  const email = loginEmailFor(login);
  if (!email) return jsonError(400, "Enter their full name or email address.");
  if (!competitionId || !auth.adminOf.has(competitionId)) return jsonError(400, "Choose a competition you run.");
  if (!canAssign(competitionId, role, auth)) return jsonError(403, "Only Super can make someone an admin.");

  // Already got a login? Then they're just added to this competition.
  const { data: list, error: listError } = await auth.admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return jsonError(500, listError.message);
  let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  let password: string | null = null;

  if (!user) {
    password = generatePassword();
    const { data, error } = await auth.admin.auth.admin.createUser({
      email,
      password,
      // Nothing to confirm for a name login, and the admin is vouching for an
      // email login by adding it here.
      email_confirm: true,
      // They choose their own password the first time they sign in
      app_metadata: { [MUST_CHOOSE_PASSWORD]: true },
      user_metadata: isNameLogin(login) ? { full_name: login } : {},
    });
    if (error) return jsonError(400, error.message);
    user = data.user;
  }

  const { data: existing } = await auth.admin
    .from("assignments")
    .select("role")
    .eq("user_id", user.id)
    .eq("competition_id", competitionId)
    .maybeSingle();
  if (existing?.role === "admin" && role === "scorer" && !auth.isSuper) {
    return jsonError(400, "They're already an admin of that competition.");
  }
  const { error: assignError } = await auth.admin
    .from("assignments")
    .upsert({ user_id: user.id, competition_id: competitionId, role, created_by: auth.caller.id });
  if (assignError) return jsonError(400, assignError.message);

  await auth.admin.from("audit_log").insert({
    competition_id: competitionId,
    user_id: auth.caller.id,
    action: "assigned",
    details: { assigned_user_id: user.id, role, new_login: Boolean(password) },
  });

  const { data: mine } = await auth.admin.from("assignments").select("competition_id, role").eq("user_id", user.id);
  const staffUser = visibleTo(toStaffUser(user, (mine ?? []) as StaffAssignment[]), {
    id: auth.caller.id,
    isSuper: auth.isSuper,
    adminOf: auth.adminOf,
  });
  return Response.json({ user: staffUser, password });
}
