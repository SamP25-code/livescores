import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Called once a day by the Vercel cron in vercel.json (and by any outside
// uptime checker). Supabase's free plan pauses a project after about a week
// without database activity, so this reads one row to keep it awake between
// competitions. The results pages load their data in the browser, so visits
// alone can't do this.
//
// It also writes the time to the one-row keepalive table (part 23), so the
// Supabase table editor shows when it last ran; the reply says when that was
// before this call. If the table isn't there yet, the read alone still counts.
export async function GET() {
  const { error } = await supabase.from("nights").select("id").limit(1);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const admin = supabaseAdmin();
  if (!admin) return Response.json({ ok: true, wrote: false });
  const { data: before } = await admin.from("keepalive").select("at").eq("id", 1).maybeSingle();
  const { error: writeError } = await admin.from("keepalive").upsert({ id: 1, at: new Date().toISOString() });
  return Response.json({ ok: true, wrote: !writeError, previous: before?.at ?? null });
}
