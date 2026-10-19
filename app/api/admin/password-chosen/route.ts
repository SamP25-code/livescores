import { MUST_CHOOSE_PASSWORD, jsonError, requireSignedIn } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// The signed-in login has chosen its own password: clear the mark that asks
// them to. Only ever changes the caller's own login.
export async function POST(request: Request) {
  const auth = await requireSignedIn(request);
  if ("response" in auth) return auth.response;
  if (!auth.caller.app_metadata?.[MUST_CHOOSE_PASSWORD]) return Response.json({ ok: true });
  const { error } = await auth.admin.auth.admin.updateUserById(auth.caller.id, {
    app_metadata: { [MUST_CHOOSE_PASSWORD]: null },
  });
  if (error) return jsonError(400, error.message);
  return Response.json({ ok: true });
}
