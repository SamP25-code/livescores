// "How to qualify" as the public sees it: each place, where it comes from,
// and who's qualified. Read only - a competition on this site shows its
// champion as soon as its final is decided.
import { supabase } from "@/lib/supabaseClient";
import { placeView, type QualifierMatch } from "@/lib/qualifying";
import { championPerson, loadQualifying } from "@/lib/qualifyingApi";

export type PublicPlace = {
  number: number;
  source: string; // "Fylde Classic · Kirkham · Sat 5 Jun" (without "Winner ·")
  name: string; // "Fylde Classic"
  location: string | null; // "Kirkham"
  wasSource: string | null; // a wildcard that was once a qualifying place
  wildcard: boolean;
  who: string | null;
  finalDate: string | null;
  // Where the source's results are: its own page on this site, or the
  // qualifier results page
  link: { competitionId: string } | { qualifierId: string } | null;
};

export async function loadPublicQualifying(competitionId: string): Promise<PublicPlace[]> {
  const data = await loadQualifying(competitionId);
  const out: PublicPlace[] = [];
  for (const p of data.places) {
    const event = p.qualifier_event_id ? data.events.get(p.qualifier_event_id) : undefined;
    const entry = p.entry_id ? data.entries.get(p.entry_id) : undefined;
    let who = entry ? (data.names.get(entry.person_id) ?? "Withdrawn player") : null;
    // On this site: the champion, as soon as the final's decided
    if (!who && p.source !== "wildcard" && event?.source_competition_id && placeView(p).state !== "flagged") {
      const champ = await championPerson(event.source_competition_id);
      if (champ) {
        const { data: person } = await supabase.from("people").select("full_name").eq("id", champ).maybeSingle();
        who = person?.full_name ?? null;
      }
    }
    const hasResults = event && !event.source_competition_id && (data.matches.get(event.id)?.length || event.winner_person_id);
    out.push({
      number: p.place_number,
      source: p.source === "wildcard" ? "Wildcard" : p.source_label.replace(/^Winner · /, ""),
      name: event?.name ?? p.source_label.replace(/^Winner · /, "").split(" · ")[0],
      location: event?.location ?? null,
      wasSource: p.source === "wildcard" ? (p.original_source_label?.replace(/^Winner · /, "") ?? null) : null,
      wildcard: p.source === "wildcard",
      who,
      finalDate: event?.final_date ?? null,
      link: event?.source_competition_id
        ? { competitionId: event.source_competition_id }
        : hasResults && event
          ? { qualifierId: event.id }
          : null,
    });
  }
  return out;
}

export type QualifierResults = {
  name: string;
  location: string | null;
  finalDate: string | null;
  qualifiesFor: { competitionId: string; title: string } | null;
  winner: string | null;
  stages: { stage: number; matches: { a: string; b: string; sa: number | null; sb: number | null; aWon: boolean; bWon: boolean }[] }[];
};

// A qualifying competition not run on this site: the results entered for it
export async function loadQualifierResults(qualifierId: string): Promise<QualifierResults | null> {
  const { data: event } = await supabase.from("qualifier_events").select("*").eq("id", qualifierId).maybeSingle();
  if (!event) return null;
  const [{ data: matches }, { data: comp }] = await Promise.all([
    supabase.from("qualifier_matches").select("*").eq("qualifier_event_id", qualifierId),
    supabase.from("competitions").select("id, year, series:series_id(name)").eq("id", event.competition_id).maybeSingle(),
  ]);
  const ids = new Set<string>();
  for (const m of (matches ?? []) as QualifierMatch[]) for (const id of [m.person_a_id, m.person_b_id]) if (id) ids.add(id);
  if (event.winner_person_id) ids.add(event.winner_person_id);
  const names = new Map<string, string>();
  if (ids.size) {
    const { data: people } = await supabase.from("people").select("id, full_name").in("id", [...ids]);
    for (const p of people ?? []) names.set(p.id, p.full_name);
  }
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? "Withdrawn player") : "TBC");
  const byStage = new Map<number, QualifierMatch[]>();
  for (const m of (matches ?? []) as QualifierMatch[]) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, []);
    byStage.get(m.stage)!.push(m);
  }
  const final = (matches ?? []).find((m: QualifierMatch) => m.stage === 1);
  let winner: string | null = event.winner_person_id ? nameOf(event.winner_person_id) : null;
  if (!winner && final && final.score_a != null && final.score_b != null && final.score_a !== final.score_b) {
    winner = nameOf(final.score_a > final.score_b ? final.person_a_id : final.person_b_id);
  }
  return {
    name: event.name,
    location: event.location,
    finalDate: event.final_date,
    qualifiesFor: comp
      ? { competitionId: comp.id, title: `${(comp.series as unknown as { name: string } | null)?.name ?? "Competition"} ${comp.year}` }
      : null,
    winner,
    stages: [...byStage.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([stage, list]) => ({
        stage,
        matches: list
          .sort((a, b) => a.slot - b.slot)
          .map((m) => ({
            a: nameOf(m.person_a_id),
            b: nameOf(m.person_b_id),
            sa: m.score_a,
            sb: m.score_b,
            aWon: m.score_a != null && m.score_b != null && m.score_a > m.score_b,
            bWon: m.score_a != null && m.score_b != null && m.score_b > m.score_a,
          })),
      })),
  };
}
