// Database calls for people and entries. The rules themselves live in
// lib/people.ts; the database's own security rules decide who can do what
// (any admin can add a person; changing or merging people is Super only;
// a competition's entries belong to its admins).
import { supabase } from "@/lib/supabaseClient";
import { normaliseName, rankMatches, sameNamePeople, tidyName, type PersonDetails } from "@/lib/people";
import type { Entry, Organiser, Person } from "@/lib/types";

export type EntryWithPeople = Entry & { person: PersonDetails; partner: PersonDetails | null };

type PersonRow = Person & { club: { short_name: string } | null };

const WITH_CLUB = "*, club:club_id(short_name)";

function toDetails(p: PersonRow, lastPlayed: Map<string, string>): PersonDetails {
  return {
    id: p.id,
    full_name: p.full_name,
    note: p.note,
    club_id: p.club_id,
    club_name: p.club?.short_name ?? null,
    last_played: lastPlayed.get(p.id) ?? null,
  };
}

// The date of each person's latest session that has already happened, worked
// out from their entries rather than stored.
async function lastPlayedFor(ids: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (ids.length === 0) return result;
  const list = ids.join(",");
  const { data, error } = await supabase
    .from("entries")
    .select("person_id, partner_id, competition:competition_id(year, nights(date))")
    .or(`person_id.in.(${list}),partner_id.in.(${list})`);
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);
  type Row = {
    person_id: string;
    partner_id: string | null;
    competition: { year: number; nights: { date: string | null }[] } | null;
  };
  for (const row of (data ?? []) as unknown as Row[]) {
    const dates = (row.competition?.nights ?? []).map((n) => n.date).filter((d): d is string => !!d && d <= today);
    if (dates.length === 0) continue;
    const latest = dates.sort().at(-1)!;
    for (const id of [row.person_id, row.partner_id]) {
      if (id && (result.get(id) ?? "") < latest) result.set(id, latest);
    }
  }
  return result;
}

async function withDetails(rows: PersonRow[]): Promise<PersonDetails[]> {
  const lastPlayed = await lastPlayedFor(rows.map((r) => r.id));
  return rows.map((r) => toDetails(r, lastPlayed));
}

// Everyone whose name matches what's been typed, best match first. Merged-away
// records are left out.
export async function searchPeople(query: string): Promise<PersonDetails[]> {
  const words = normaliseName(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  // Narrow down in the database by the longest word typed, then match properly here
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a)).replace(/[%_\\]/g, "");
  const { data, error } = await supabase
    .from("people")
    .select(WITH_CLUB)
    .is("merged_into_id", null)
    .ilike("full_name", `%${longest}%`)
    .limit(200);
  if (error) throw error;
  const matches = rankMatches((data ?? []) as PersonRow[], query).slice(0, 12);
  return withDetails(matches);
}

// People already in the app with exactly this name
export async function findSameName(fullName: string): Promise<PersonDetails[]> {
  const name = tidyName(fullName).replace(/[%_\\]/g, "");
  if (!name) return [];
  const { data, error } = await supabase
    .from("people")
    .select(WITH_CLUB)
    .is("merged_into_id", null)
    .ilike("full_name", name);
  if (error) throw error;
  return withDetails(sameNamePeople((data ?? []) as PersonRow[], fullName));
}

export async function listClubs(): Promise<Organiser[]> {
  const { data, error } = await supabase.from("organisers").select("*").eq("kind", "club").order("short_name");
  if (error) throw error;
  return data ?? [];
}

export async function createPerson(p: { full_name: string; club_id: string | null; note: string | null }): Promise<PersonDetails> {
  const { data, error } = await supabase
    .from("people")
    .insert({ full_name: tidyName(p.full_name), club_id: p.club_id, note: p.note?.trim() || null })
    .select(WITH_CLUB)
    .single();
  if (error) throw error;
  return toDetails(data as PersonRow, new Map());
}

// Super: correct a person's name, club or note
export async function updatePerson(id: string, p: { full_name: string; club_id: string | null; note: string | null }): Promise<void> {
  const { error } = await supabase
    .from("people")
    .update({ full_name: tidyName(p.full_name), club_id: p.club_id, note: p.note?.trim() || null })
    .eq("id", id);
  if (error) throw error;
}

// Super: two records are the same person. Everything moves to keepId.
export async function mergePeople(removeId: string, keepId: string): Promise<void> {
  const { error } = await supabase.rpc("merge_people", { remove_id: removeId, keep_id: keepId });
  if (error) throw error;
}

// A competition's entries, earliest first, with their people's details
export async function listEntries(competitionId: string): Promise<EntryWithPeople[]> {
  const { data, error } = await supabase
    .from("entries")
    .select(`*, person:person_id(${WITH_CLUB}), partner:partner_id(${WITH_CLUB})`)
    .eq("competition_id", competitionId)
    .order("created_at");
  if (error) throw error;
  type Row = Entry & { person: PersonRow; partner: PersonRow | null };
  const rows = (data ?? []) as Row[];
  const people = rows.flatMap((r) => (r.partner ? [r.person, r.partner] : [r.person]));
  const lastPlayed = await lastPlayedFor(people.map((p) => p.id));
  return rows.map((r) => ({
    ...r,
    person: toDetails(r.person, lastPlayed),
    partner: r.partner ? toDetails(r.partner, lastPlayed) : null,
  }));
}

async function log(competitionId: string, action: string, details: Record<string, unknown>) {
  const { error } = await supabase.from("audit_log").insert({ competition_id: competitionId, action, details });
  if (error) throw error;
}

export async function addEntry(competitionId: string, personId: string, partnerId: string | null): Promise<void> {
  const { data, error } = await supabase
    .from("entries")
    .insert({ competition_id: competitionId, person_id: personId, partner_id: partnerId })
    .select("id")
    .single();
  if (error) throw error;
  await log(competitionId, "entry_added", { entry_id: data.id, person_id: personId, partner_id: partnerId });
}

export async function setEntryStatus(entry: Entry, status: Entry["status"]): Promise<void> {
  const { error } = await supabase.from("entries").update({ status }).eq("id", entry.id);
  if (error) throw error;
  await log(entry.competition_id, status === "withdrawn" ? "entry_withdrawn" : "entry_reinstated", { entry_id: entry.id });
}

// Someone was picked wrongly: point the entry at the right person or people.
// Any results already played move with the entry.
export async function changeEntryPeople(entry: Entry, personId: string, partnerId: string | null): Promise<void> {
  const { error } = await supabase
    .from("entries")
    .update({ person_id: personId, partner_id: partnerId })
    .eq("id", entry.id);
  if (error) throw error;
  await log(entry.competition_id, "entry_changed", {
    entry_id: entry.id,
    from: { person_id: entry.person_id, partner_id: entry.partner_id },
    to: { person_id: personId, partner_id: partnerId },
  });
}

// Removes an entry made by mistake. Only allowed while it isn't in any draw;
// once it is, withdraw it instead.
export async function deleteEntry(entry: Entry): Promise<void> {
  const { count, error: countError } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entry.id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) throw new Error("This entry is already in a draw - withdraw it instead.");
  const { error } = await supabase.from("entries").delete().eq("id", entry.id);
  if (error) throw error;
  await log(entry.competition_id, "entry_removed", { entry_id: entry.id, person_id: entry.person_id, partner_id: entry.partner_id });
}
