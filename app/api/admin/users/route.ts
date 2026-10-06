import { isNameLogin, loginEmailFor } from "@/lib/loginName";
import { toAdminUser } from "@/lib/adminUsers";
import { generatePassword } from "@/lib/password";
import { jsonError, requireOwner } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Every admin and scorer login, by name.
export async function GET(request: Request) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return jsonError(500, error.message);
  const users = data.users.map(toAdminUser).sort((a, b) => a.name.localeCompare(b.name));
  return Response.json({ users, callerId: auth.caller.id });
}

// Adds a login with a freshly generated password, which is sent back once
// so the admin can pass it on. Body: { login: full name or email, role }.
export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const login = typeof body?.login === "string" ? body.login.trim().replace(/\s+/g, " ") : "";
  const role = body?.role === "scorer" ? "scorer" : "owner";

  const email = loginEmailFor(login);
  if (!email) return jsonError(400, "Enter their full name or email address.");
  const password = generatePassword();

  const { data, error } = await auth.admin.auth.admin.createUser({
    email,
    password,
    // Nothing to confirm for a name login, and the admin is vouching for
    // an email login by adding it here.
    email_confirm: true,
    app_metadata: role === "scorer" ? { role: "scorer" } : {},
    user_metadata: isNameLogin(login) ? { full_name: login } : {},
  });
  if (error) {
    return jsonError(
      400,
      /already (been )?registered|already exists/i.test(error.message)
        ? `There's already a login for ${login}.`
        : error.message
    );
  }
  return Response.json({ user: toAdminUser(data.user), password });
}
