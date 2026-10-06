import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

// Called once a day by the Vercel cron in vercel.json. Supabase's free plan
// pauses a project after about a week without database activity, so this
// reads one row to keep it awake between competitions. The results pages
// load their data in the browser, so visits alone can't do this.
export async function GET() {
  const { error } = await supabase.from("nights").select("id").limit(1);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
