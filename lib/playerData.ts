// Loads a player's page: who they are, then everything they've entered,
// played and won (put together by lib/playerRecord.ts). Someone who's asked
// to be taken off the site can't be read here, so their page doesn't exist.
import { supabase } from "@/lib/supabaseClient";
import { buildPlayerQualifiers, type PlayerQualifier } from "@/lib/playerQualifiers";
import { loadPublicCompetitionsShared } from "@/lib/publicData";
import { todayIso, type PublicCompetition } from "@/lib/publicCompetitions";
import {
  buildPlayerRecord,
  type PlayerRecord,
  type RecordEntry,
  type RecordHonour,
  type RecordMatch,
  type RecordPlace,
} from "@/lib/playerRecord";

export type PlayerPerson = {
  id: string;
  full_name: string;
  note: string | null;
  club: { id: string; name: string; short_name: string; slug: string | null } | null;
};

export type PlayerPage = {
  person: PlayerPerson;
  record: PlayerRecord;
  // Qualifying competitions not run on this site (the Masters' qualifiers)
  qualifiers: PlayerQualifier[];
  all: PublicCompetition[];
};

// Their results in qualifying competitions entered by an organiser rather
// than run on this site. A failure here leaves them out rather than the page.
async function loadQualifiers(id: string): Promise<PlayerQualifier[]> {
  const [{ data: mineRows }, { data: wonRows }] = await Promise.all([
    supabase.from("qualifier_matches").select("qualifier_event_id").or(`person_a_id.eq.${id},person_b_id.eq.${id}`),
    supabase.from("qualifier_events").select("id").eq("winner_person_id", id),
  ]);
  const eventIds = [
    ...new Set([...(mineRows ?? []).map((m) => m.qualifier_event_id as string), ...(wonRows ?? []).map((e) => e.id as string)]),
  ];
  if (eventIds.length === 0) return [];
  const [{ data: events }, { data: matches }] = await Promise.all([
    supabase.from("qualifier_events").select("id, name, location, final_date, results_depth, winner_person_id").in("id", eventIds),
    supabase.from("qualifier_matches").select("*").in("qualifier_event_id", eventIds),
  ]);
  const opponentIds = [
    ...new Set(
      (matches ?? [])
        .filter((m) => m.person_a_id === id || m.person_b_id === id)
        .flatMap((m) => [m.person_a_id, m.person_b_id])
        .filter((p): p is string => Boolean(p) && p !== id)
    ),
  ];
  const { data: people } = opponentIds.length
    ? await supabase.from("people").select("id, full_name").in("id", opponentIds)
    : { data: [] };
  const names = new Map(((people ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  return buildPlayerQualifiers({ personId: id, events: events ?? [], matches: matches ?? [], names });
}

// null: no such player (or taken off). { mergedInto }: the same person under
// another record now - open theirs instead.
export async function loadPlayer(id: string): Promise<PlayerPage | { mergedInto: string } | null> {
  const { data: person, error } = await supabase
    .from("people")
    .select("id, full_name, note, merged_into_id, club:club_id(id, name, short_name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!person) return null;
  if (person.merged_into_id) return { mergedInto: person.merged_into_id };

  const [{ data: entryRows, error: entryError }, all, { data: honourRows }, qualifiers] = await Promise.all([
    supabase.from("entries").select("id, competition_id, person_id, partner_id, status").or(`person_id.eq.${id},partner_id.eq.${id}`),
    loadPublicCompetitionsShared(),
    supabase
      .from("honours_history")
      .select(
        "year, winner_person_id, winner_partner_id, runner_up_person_id, runner_up_partner_id, series:series_id(name, slug)"
      )
      .or(
        `winner_person_id.eq.${id},winner_partner_id.eq.${id},runner_up_person_id.eq.${id},runner_up_partner_id.eq.${id}`
      ),
    loadQualifiers(id).catch(() => [] as PlayerQualifier[]),
  ]);
  if (entryError) throw entryError;
  const entries = (entryRows ?? []) as RecordEntry[];

  // Their places in each session's draw, then every match in those sessions
  // (the round names need to know how many matches each round has)
  const entryIds = entries.map((e) => e.id);
  const { data: placeRows } = entryIds.length
    ? await supabase.from("players").select("id, night_id, entry_id").in("entry_id", entryIds)
    : { data: [] };
  const places = (placeRows ?? []) as RecordPlace[];
  const nightIds = [...new Set(places.map((p) => p.night_id))];
  const { data: matchRows } = nightIds.length
    ? await supabase
        .from("matches")
        .select("id, night_id, round, slot, status, winner_id, player_a_id, player_b_id, score_a, score_b")
        .in("night_id", nightIds)
    : { data: [] };
  const matches = (matchRows ?? []) as RecordMatch[];

  // Names: partners (people) and opponents (places in the draw)
  const names = new Map<string, string>();
  const partnerIds = [...new Set(entries.flatMap((e) => [e.person_id, e.partner_id]).filter((p): p is string => Boolean(p) && p !== id))];
  const mine = new Set(places.map((p) => p.id));
  const opponentIds = [
    ...new Set(
      matches
        .filter((m) => (m.player_a_id && mine.has(m.player_a_id)) || (m.player_b_id && mine.has(m.player_b_id)))
        .flatMap((m) => [m.player_a_id, m.player_b_id])
        .filter((p): p is string => Boolean(p) && !mine.has(p!))
    ),
  ];
  const [{ data: partners }, { data: opponents }] = await Promise.all([
    partnerIds.length ? supabase.from("people").select("id, full_name").in("id", partnerIds) : Promise.resolve({ data: [] }),
    opponentIds.length
      ? supabase.from("players").select("id, name, entry:entry_id(person_id, partner_id)").in("id", opponentIds)
      : Promise.resolve({ data: [] }),
  ]);
  for (const p of (partners ?? []) as { id: string; full_name: string }[]) names.set(p.id, p.full_name);
  const peopleOf = new Map<string, string[]>();
  for (const p of (opponents ?? []) as unknown as { id: string; name: string; entry: { person_id: string; partner_id: string | null } | null }[]) {
    names.set(p.id, p.name);
    if (p.entry) peopleOf.set(p.id, [p.entry.person_id, p.entry.partner_id].filter((x): x is string => Boolean(x)));
  }

  const honours: RecordHonour[] = (honourRows ?? []).flatMap((h) => {
    const series = h.series as unknown as { name: string; slug: string } | null;
    if (!series) return [];
    return [{ year: h.year, seriesName: series.name, seriesSlug: series.slug, place: h.winner_person_id === id || h.winner_partner_id === id ? "Winner" : "Runner-up" } as RecordHonour];
  });

  const record = buildPlayerRecord({ personId: id, entries, places, matches, names, peopleOf, competitions: all, honours, today: todayIso() });
  return {
    person: { id: person.id, full_name: person.full_name, note: person.note, club: (person.club as unknown as PlayerPerson["club"]) ?? null },
    record,
    qualifiers,
    all,
  };
}
