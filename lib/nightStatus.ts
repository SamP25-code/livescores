import { supabase } from "@/lib/supabaseClient";
import { computeNightStatus, type NightStatus } from "@/lib/bracket";

/**
 * Every night's live status, derived from its matches - see
 * computeNightStatus. A night with no matches simply won't have an entry;
 * treat a missing id as "upcoming".
 */
export async function fetchNightStatuses(): Promise<Record<string, NightStatus>> {
  const { data } = await supabase.from("matches").select("night_id, round, status");

  const byNight = new Map<string, Array<{ round: number; status: string }>>();
  for (const m of data ?? []) {
    if (!byNight.has(m.night_id)) byNight.set(m.night_id, []);
    byNight.get(m.night_id)!.push({ round: m.round, status: m.status });
  }

  return Object.fromEntries(
    [...byNight.entries()].map(([nightId, matches]) => [nightId, computeNightStatus(matches)])
  );
}
