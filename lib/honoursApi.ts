// Past winners on a competition's honours board (Super): years from before
// the site, added by hand. Each name is a person, so it links to their
// player page; a doubles year names both partners.
import { supabase } from "@/lib/supabaseClient";

export type PastWinner = {
  id: string;
  year: number;
  winner_person_id: string | null;
  winner_partner_id: string | null;
  runner_up_person_id: string | null;
  runner_up_partner_id: string | null;
  // Names for showing the list
  winner: string;
  runnerUp: string | null;
  // Each person's name, for changing the year
  names: Record<string, string>;
};

type Row = {
  id: string;
  year: number;
  winner_person_id: string | null;
  winner_partner_id: string | null;
  runner_up_person_id: string | null;
  runner_up_partner_id: string | null;
  winner_text: string | null;
  runner_up_text: string | null;
};

export async function listPastWinners(seriesId: string): Promise<PastWinner[]> {
  const { data, error } = await supabase
    .from("honours_history")
    .select("id, year, winner_person_id, winner_partner_id, runner_up_person_id, runner_up_partner_id, winner_text, runner_up_text")
    .eq("series_id", seriesId)
    .order("year", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const ids = [
    ...new Set(
      rows
        .flatMap((r) => [r.winner_person_id, r.winner_partner_id, r.runner_up_person_id, r.runner_up_partner_id])
        .filter((x): x is string => Boolean(x))
    ),
  ];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await supabase.from("people").select("id, full_name").in("id", ids);
    for (const p of people ?? []) names.set(p.id, p.full_name);
  }
  const pair = (a: string | null, b: string | null, text: string | null) =>
    [a, b]
      .filter((x): x is string => Boolean(x))
      .map((x) => names.get(x) ?? "?")
      .join(" & ") || text;
  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    winner_person_id: r.winner_person_id,
    winner_partner_id: r.winner_partner_id,
    runner_up_person_id: r.runner_up_person_id,
    runner_up_partner_id: r.runner_up_partner_id,
    winner: pair(r.winner_person_id, r.winner_partner_id, r.winner_text) ?? "",
    runnerUp: pair(r.runner_up_person_id, r.runner_up_partner_id, r.runner_up_text),
    names: Object.fromEntries(names),
  }));
}

// Adds a year, or replaces what's there for that year
export async function savePastWinner(
  seriesId: string,
  w: {
    year: number;
    winner_person_id: string;
    winner_partner_id: string | null;
    runner_up_person_id: string | null;
    runner_up_partner_id: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("honours_history")
    .upsert({ series_id: seriesId, ...w, winner_text: null, runner_up_text: null }, { onConflict: "series_id,year" });
  if (error) throw error;
}

export async function deletePastWinner(id: string): Promise<void> {
  const { error } = await supabase.from("honours_history").delete().eq("id", id);
  if (error) throw error;
}
