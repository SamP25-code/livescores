// Database calls for the Super set-up screens. The rules themselves live in
// lib/competitionSetup.ts; the database's own security rules make sure only
// a Super login can do any of this.
import { supabase } from "@/lib/supabaseClient";
import { planSessions, sessionName, type SessionKind } from "@/lib/competitionSetup";
import type { Competition, Night, Organiser, Series, Venue } from "@/lib/types";

export type CompetitionWithSeries = Competition & {
  series: Series & { organiser: Organiser };
};

export type SessionDetails = { date: string | null; start_time: string | null };

// Everything set up so far, newest year first.
export async function listCompetitions(): Promise<CompetitionWithSeries[]> {
  const { data, error } = await supabase
    .from("competitions")
    .select("*, series:series_id(*, organiser:organiser_id(*))")
    .order("year", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompetitionWithSeries[];
}

export async function getCompetition(
  id: string
): Promise<{ competition: CompetitionWithSeries; sessions: Night[] }> {
  const [{ data: competition, error }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("competitions").select("*, series:series_id(*, organiser:organiser_id(*))").eq("id", id).single(),
    supabase.from("nights").select("*").eq("competition_id", id).order("session_number"),
  ]);
  if (error) throw error;
  if (sessionsError) throw sessionsError;
  return { competition: competition as CompetitionWithSeries, sessions: (sessions ?? []) as Night[] };
}

export async function listChoices(): Promise<{ organisers: Organiser[]; series: Series[]; venues: Venue[] }> {
  const [o, s, v] = await Promise.all([
    supabase.from("organisers").select("*").order("short_name"),
    supabase.from("series").select("*").order("name"),
    supabase.from("venues").select("*").order("name"),
  ]);
  for (const r of [o, s, v]) if (r.error) throw r.error;
  return { organisers: o.data ?? [], series: s.data ?? [], venues: v.data ?? [] };
}

export async function createOrganiser(o: Pick<Organiser, "name" | "short_name" | "kind">): Promise<Organiser> {
  const { data, error } = await supabase.from("organisers").insert(o).select().single();
  if (error) throw error;
  return data;
}

export async function createSeries(s: Pick<Series, "organiser_id" | "name" | "slug">): Promise<Series> {
  const { data, error } = await supabase.from("series").insert(s).select().single();
  if (error) {
    if (error.code === "23505") throw new Error(`The address /${s.slug} is already taken - choose another.`);
    throw error;
  }
  return data;
}

export async function createVenue(v: Pick<Venue, "name" | "address" | "postcode" | "notes">): Promise<Venue> {
  const { data, error } = await supabase.from("venues").insert(v).select().single();
  if (error) throw error;
  return data;
}

export type CompetitionInput = Omit<Competition, "id" | "created_at" | "structure_locked">;

// Creates the competition and its sessions together. If the sessions can't
// be created, the competition is removed again so nothing half-made is left.
export async function createCompetition(
  input: CompetitionInput,
  sessionDetails: SessionDetails[]
): Promise<Competition> {
  const { data: competition, error } = await supabase.from("competitions").insert(input).select().single();
  if (error) {
    if (error.code === "23505") throw new Error(`There's already a ${input.year} edition of this competition.`);
    throw error;
  }
  try {
    await syncSessions(competition as Competition, [], sessionDetails);
  } catch (err) {
    await supabase.from("competitions").delete().eq("id", competition.id);
    throw err;
  }
  return competition as Competition;
}

// Saves changed settings. The structure can only change while unlocked
// (before the first draw); the database blocks it otherwise.
export async function updateCompetition(
  competition: Competition,
  changes: Partial<CompetitionInput>,
  currentSessions: Night[],
  sessionDetails: SessionDetails[]
): Promise<void> {
  const { data, error } = await supabase
    .from("competitions")
    .update(changes)
    .eq("id", competition.id)
    .select()
    .single();
  if (error) throw error;
  await syncSessions(data as Competition, currentSessions, sessionDetails);
}

// Makes the competition's sessions match its format: adds any that are
// missing, updates dates / times / names, and removes ones no longer needed
// - but never a session that already has players on it.
async function syncSessions(
  competition: Competition,
  current: Night[],
  details: SessionDetails[]
): Promise<void> {
  const plan = planSessions(competition.format, competition.qualifying_nights);
  const byKey = new Map(current.map((n) => [`${n.kind}:${n.session_number}`, n]));
  const keep = new Set<string>();

  for (let i = 0; i < plan.length; i++) {
    const { kind, session_number } = plan[i];
    const key = `${kind}:${session_number}`;
    keep.add(key);
    const date = details[i]?.date || null;
    const start_time = details[i]?.start_time || null;
    const fields = {
      kind,
      session_number,
      sort_order: session_number,
      date,
      start_time,
      name: sessionName(kind as SessionKind, session_number, date),
    };
    const existing = byKey.get(key);
    if (existing) {
      const { error } = await supabase.from("nights").update(fields).eq("id", existing.id);
      if (error) throw error;
    } else {
      // Finals Day fills itself as qualifiers come through, so it's shown
      // straight away; every other session waits for "Publish draw".
      const { error } = await supabase.from("nights").insert({
        ...fields,
        competition_id: competition.id,
        status: "upcoming",
        draw_published: kind === "finals",
      });
      if (error) throw error;
    }
  }

  for (const night of current) {
    if (keep.has(`${night.kind}:${night.session_number}`)) continue;
    const { count } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("night_id", night.id);
    if ((count ?? 0) > 0) {
      throw new Error(`${night.name} already has players on it, so it can't be removed.`);
    }
    const { error } = await supabase.from("nights").delete().eq("id", night.id);
    if (error) throw error;
  }
}
