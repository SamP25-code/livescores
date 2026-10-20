// Database calls for qualifying (see lib/qualifying.ts for the rules). A
// competition entered by qualification has places; each is filled by the
// winner of its qualifying competition, or chosen as a wildcard. Whoever
// fills a place gets an entry in the competition, so the draw works as usual.
import { supabase } from "@/lib/supabaseClient";
import { deleteEntry } from "@/lib/peopleApi";
import {
  duplicateOf,
  eventWinner,
  sourceLabel,
  type Place,
  type QualifierEvent,
  type QualifierMatch,
  type ResultsDepth,
} from "@/lib/qualifying";
import type { Entry } from "@/lib/types";

export type QualifyingData = {
  places: Place[];
  events: Map<string, QualifierEvent>;
  matches: Map<string, QualifierMatch[]>; // by qualifier event
  entries: Map<string, Entry>; // the places' entries
  names: Map<string, string>; // person id -> name
};

async function log(competitionId: string, action: string, details: Record<string, unknown>) {
  await supabase.from("audit_log").insert({ competition_id: competitionId, action, details });
}

export async function loadQualifying(competitionId: string): Promise<QualifyingData> {
  const [{ data: places, error }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("qualifying_places").select("*").eq("competition_id", competitionId).order("place_number"),
    supabase.from("qualifier_events").select("*").eq("competition_id", competitionId),
  ]);
  if (error) throw error;
  if (eventsError) throw eventsError;
  const eventIds = (events ?? []).map((e) => e.id);
  const entryIds = (places ?? []).map((p) => p.entry_id).filter((id): id is string => Boolean(id));
  const [{ data: matches }, { data: entries }] = await Promise.all([
    eventIds.length
      ? supabase.from("qualifier_matches").select("*").in("qualifier_event_id", eventIds)
      : Promise.resolve({ data: [] as (QualifierMatch & { qualifier_event_id: string })[] }),
    entryIds.length ? supabase.from("entries").select("*").in("id", entryIds) : Promise.resolve({ data: [] as Entry[] }),
  ]);
  const byEvent = new Map<string, QualifierMatch[]>();
  for (const m of (matches ?? []) as (QualifierMatch & { qualifier_event_id: string })[]) {
    if (!byEvent.has(m.qualifier_event_id)) byEvent.set(m.qualifier_event_id, []);
    byEvent.get(m.qualifier_event_id)!.push(m);
  }
  const personIds = new Set<string>();
  for (const e of (entries ?? []) as Entry[]) personIds.add(e.person_id);
  for (const ev of (events ?? []) as QualifierEvent[]) if (ev.winner_person_id) personIds.add(ev.winner_person_id);
  for (const list of byEvent.values())
    for (const m of list) for (const id of [m.person_a_id, m.person_b_id]) if (id) personIds.add(id);
  const names = new Map<string, string>();
  if (personIds.size) {
    const { data: people } = await supabase.from("people").select("id, full_name").in("id", [...personIds]);
    for (const p of people ?? []) names.set(p.id, p.full_name);
  }
  return {
    places: (places ?? []) as Place[],
    events: new Map(((events ?? []) as QualifierEvent[]).map((e) => [e.id, e])),
    matches: byEvent,
    entries: new Map(((entries ?? []) as Entry[]).map((e) => [e.id, e])),
    names,
  };
}

// The champion of a competition run on this site (its final's winner), if decided
export async function championPerson(competitionId: string): Promise<string | null> {
  const { data: sessions } = await supabase
    .from("nights")
    .select("id, kind")
    .eq("competition_id", competitionId)
    .neq("kind", "qualifier");
  for (const s of sessions ?? []) {
    const { data: matches } = await supabase.from("matches").select("round, status, winner_id").eq("night_id", s.id);
    if (!matches?.length) continue;
    const top = Math.max(...matches.map((m) => m.round));
    const final = matches.filter((m) => m.round === top);
    if (final.length !== 1 || final[0].status !== "complete" || !final[0].winner_id) continue;
    const { data: place } = await supabase.from("players").select("entry_id").eq("id", final[0].winner_id).single();
    if (!place?.entry_id) continue;
    const { data: entry } = await supabase.from("entries").select("person_id").eq("id", place.entry_id).single();
    return entry?.person_id ?? null;
  }
  return null;
}

async function newEntry(competitionId: string, personId: string): Promise<string> {
  const { data, error } = await supabase
    .from("entries")
    .insert({ competition_id: competitionId, person_id: personId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// Takes a place's entry away, if it isn't in a draw already made
async function dropEntry(entry: Entry | undefined): Promise<boolean> {
  if (!entry) return true;
  try {
    await deleteEntry(entry);
    return true;
  } catch {
    return false;
  }
}

// Fills every qualifying place from its winner: a competition on this site
// fills from its champion, others from the results entered here. Someone
// who has already qualified through an earlier place isn't given a second -
// that place is flagged for the admin to decide. Safe to run any time.
export async function fillPlaces(competitionId: string): Promise<void> {
  const data = await loadQualifying(competitionId);
  const filled: { placeId: string; placeNumber: number; personId: string }[] = [];
  for (const p of data.places) {
    const e = p.entry_id ? data.entries.get(p.entry_id) : undefined;
    if (e) filled.push({ placeId: p.id, placeNumber: p.place_number, personId: e.person_id });
  }

  for (const place of data.places) {
    if (place.source === "wildcard" || !place.qualifier_event_id) continue;
    const event = data.events.get(place.qualifier_event_id);
    if (!event) continue;
    const winner = event.source_competition_id
      ? await championPerson(event.source_competition_id)
      : eventWinner(event, data.matches.get(event.id) ?? []);
    const current = place.entry_id ? data.entries.get(place.entry_id) : undefined;
    const update = async (fields: Partial<Place>) => {
      const { error } = await supabase.from("qualifying_places").update(fields).eq("id", place.id);
      if (error) throw error;
    };

    if (current && current.person_id === winner) {
      if (place.flagged) await update({ flagged: null });
      continue;
    }
    // No winner yet (or results taken away): empty the place
    if (!winner) {
      if (current && (await dropEntry(current))) await update({ entry_id: null, flagged: null });
      continue;
    }
    const dup = duplicateOf(winner, place, filled);
    if (dup !== null) {
      const flag = `${data.names.get(winner) ?? "The winner"} already qualified via place ${dup} - make this a wildcard?`;
      if (current) await dropEntry(current);
      await update({ entry_id: null, flagged: flag });
      continue;
    }
    if (current && !(await dropEntry(current))) {
      await update({ flagged: "The result changed after the draw was made - change this entry by hand." });
      continue;
    }
    const entryId = await newEntry(competitionId, winner);
    await update({ entry_id: entryId, flagged: null });
    filled.push({ placeId: place.id, placeNumber: place.place_number, personId: winner });
    await log(competitionId, "qualified", { place: place.place_number, person_id: winner, from: event.name });
  }
}

export type QualifierInput = {
  name: string;
  location: string | null;
  final_date: string | null;
  source_competition_id: string | null;
  results_depth: ResultsDepth;
};

// A new qualifying competition, and the place its winner fills
export async function addQualifier(competitionId: string, input: QualifierInput): Promise<void> {
  if (!input.name.trim()) throw new Error("Enter the qualifying competition's name.");
  const { data: event, error } = await supabase
    .from("qualifier_events")
    .insert({ competition_id: competitionId, ...input, name: input.name.trim() })
    .select()
    .single();
  if (error) throw error;
  const { data: last } = await supabase
    .from("qualifying_places")
    .select("place_number")
    .eq("competition_id", competitionId)
    .order("place_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: placeError } = await supabase.from("qualifying_places").insert({
    competition_id: competitionId,
    place_number: (last?.place_number ?? 0) + 1,
    source: "winner_of",
    source_label: sourceLabel(event as QualifierEvent),
    qualifier_event_id: event.id,
  });
  if (placeError) {
    await supabase.from("qualifier_events").delete().eq("id", event.id);
    throw placeError;
  }
  if (input.source_competition_id) await fillPlaces(competitionId);
}

export async function updateQualifier(event: QualifierEvent, input: QualifierInput): Promise<void> {
  const { data, error } = await supabase
    .from("qualifier_events")
    .update({ ...input, name: input.name.trim() })
    .eq("id", event.id)
    .select()
    .single();
  if (error) throw error;
  await supabase
    .from("qualifying_places")
    .update({ source_label: sourceLabel(data as QualifierEvent) })
    .eq("qualifier_event_id", event.id)
    .neq("source", "wildcard");
  await fillPlaces(event.competition_id);
}

export async function addWildcardPlace(competitionId: string): Promise<void> {
  const { data: last } = await supabase
    .from("qualifying_places")
    .select("place_number")
    .eq("competition_id", competitionId)
    .order("place_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("qualifying_places").insert({
    competition_id: competitionId,
    place_number: (last?.place_number ?? 0) + 1,
    source: "wildcard",
    source_label: "Wildcard",
  });
  if (error) throw error;
}

// Saves a qualifying competition's results, then fills its place
export async function saveResults(
  event: QualifierEvent,
  matches: QualifierMatch[],
  winnerPersonId: string | null
): Promise<void> {
  const { error: removeError } = await supabase.from("qualifier_matches").delete().eq("qualifier_event_id", event.id);
  if (removeError) throw removeError;
  const rows = matches
    .filter((m) => m.person_a_id || m.person_b_id)
    .map((m) => ({ ...m, qualifier_event_id: event.id }));
  if (rows.length) {
    const { error } = await supabase.from("qualifier_matches").insert(rows);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("qualifier_events")
    .update({ winner_person_id: event.results_depth === "winner" ? winnerPersonId : null })
    .eq("id", event.id);
  if (error) throw error;
  await log(event.competition_id, "qualifier_results", { qualifier: event.name });
  await fillPlaces(event.competition_id);
}

// The place becomes a wildcard (a qualifier can't make it, or qualified
// twice). Where it came from is kept on record.
export async function makeWildcard(place: Place, entry: Entry | undefined): Promise<void> {
  if (entry && !(await dropEntry(entry))) throw new Error("They're already in the draw - replace them there instead.");
  const { error } = await supabase
    .from("qualifying_places")
    .update({
      source: "wildcard",
      original_source_label: place.original_source_label ?? place.source_label,
      source_label: "Wildcard",
      entry_id: null,
      flagged: null,
    })
    .eq("id", place.id);
  if (error) throw error;
  await log(place.competition_id, "wildcard_set", { place: place.place_number, was: place.source_label });
}

// Fills a wildcard (or empties it, with null)
export async function fillWildcard(place: Place, entry: Entry | undefined, personId: string | null, others: QualifyingData): Promise<void> {
  if (personId) {
    const filled = others.places
      .filter((p) => p.entry_id && others.entries.get(p.entry_id))
      .map((p) => ({ placeId: p.id, placeNumber: p.place_number, personId: others.entries.get(p.entry_id!)!.person_id }));
    const dup = duplicateOf(personId, place, filled);
    if (dup !== null) throw new Error(`They've already qualified - place ${dup}.`);
  }
  if (entry && !(await dropEntry(entry))) throw new Error("They're already in the draw - replace them there instead.");
  const entryId = personId ? await newEntry(place.competition_id, personId) : null;
  const { error } = await supabase.from("qualifying_places").update({ entry_id: entryId, flagged: null }).eq("id", place.id);
  if (error) throw error;
  if (personId) await log(place.competition_id, "wildcard_filled", { place: place.place_number, person_id: personId });
}

// Takes a place out altogether (and its qualifying competition)
export async function removePlace(place: Place, entry: Entry | undefined): Promise<void> {
  if (entry && !(await dropEntry(entry))) throw new Error("Its qualifier is already in the draw.");
  const { error } = await supabase.from("qualifying_places").delete().eq("id", place.id);
  if (error) throw error;
  if (place.qualifier_event_id) await supabase.from("qualifier_events").delete().eq("id", place.qualifier_event_id);
}
