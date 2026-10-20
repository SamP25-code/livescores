// Database calls for the Super set-up screens. The rules themselves live in
// lib/competitionSetup.ts; the database's own security rules make sure only
// a Super login can do any of this.
import { supabase } from "@/lib/supabaseClient";
import { planSessions, sessionName, slugify, type SessionKind } from "@/lib/competitionSetup";
import type { Competition, CompetitionSponsor, Night, Organiser, Series, Venue } from "@/lib/types";

export type CompetitionWithSeries = Competition & {
  series: Series & { organiser: Organiser };
  sponsors: CompetitionSponsor[];
};

export type SponsorInput = { name: string; url: string; logo_url?: string | null };

const WITH_SERIES = "*, series:series_id(*, organiser:organiser_id(*)), sponsors:competition_sponsors(*)";

// Sponsors in the order they were added (position 1 first)
function sortSponsors<T extends { sponsors?: CompetitionSponsor[] }>(c: T): T {
  return { ...c, sponsors: [...(c.sponsors ?? [])].sort((a, b) => a.position - b.position) };
}

export type SessionDetails = { date: string | null; start_time: string | null; practice_time: string | null };

// Everything set up so far, newest year first.
export async function listCompetitions(): Promise<CompetitionWithSeries[]> {
  const { data, error } = await supabase
    .from("competitions")
    .select(WITH_SERIES)
    .order("year", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CompetitionWithSeries[]).map(sortSponsors);
}

export async function getCompetition(
  id: string
): Promise<{ competition: CompetitionWithSeries; sessions: Night[] }> {
  const [{ data: competition, error }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("competitions").select(WITH_SERIES).eq("id", id).single(),
    supabase.from("nights").select("*").eq("competition_id", id).order("session_number"),
  ]);
  if (error) throw error;
  if (sessionsError) throw sessionsError;
  return { competition: sortSponsors(competition as CompetitionWithSeries), sessions: (sessions ?? []) as Night[] };
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

// A new club or event. An event also gets its page's web address
// (/blackpool-masters), from its short name.
export async function createOrganiser(o: Pick<Organiser, "name" | "short_name" | "kind">): Promise<Organiser> {
  const slug = slugify(o.short_name);
  const { data, error } = await supabase.from("organisers").insert({ ...o, slug: slug || null }).select().single();
  if (error) {
    if (error.code === "23505") throw new Error(`The address /${slug} is already taken - choose a different short name.`);
    throw error;
  }
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

export type VenueInput = Pick<Venue, "name" | "address" | "postcode" | "notes" | "map_url">;

export async function createVenue(v: VenueInput): Promise<Venue> {
  const { data, error } = await supabase.from("venues").insert(v).select().single();
  if (error) throw error;
  return data;
}

// Super: correct a venue's details (it changes for every competition using it)
export async function updateVenue(id: string, v: VenueInput): Promise<Venue> {
  const { data, error } = await supabase.from("venues").update(v).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export type CompetitionInput = Omit<Competition, "id" | "created_at" | "structure_locked">;

// Replaces a competition's sponsors with this list, in this order. Rows with
// no name are left out.
export async function saveSponsors(competitionId: string, sponsors: SponsorInput[]): Promise<void> {
  const rows = sponsors
    .map((s) => ({ name: s.name.trim(), url: s.url.trim() || null, logo_url: s.logo_url || null }))
    .filter((s) => s.name)
    .map((s, i) => ({ ...s, competition_id: competitionId, position: i + 1 }));
  const { error: removeError } = await supabase.from("competition_sponsors").delete().eq("competition_id", competitionId);
  if (removeError) throw removeError;
  if (rows.length === 0) return;
  const { error } = await supabase.from("competition_sponsors").insert(rows);
  if (error) throw error;
}

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
    const practice_time = details[i]?.practice_time || null;
    const fields = {
      kind,
      session_number,
      sort_order: session_number,
      date,
      start_time,
      practice_time,
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

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];

// Super: uploads a sponsor's logo to the public "sponsor-logos" folder and
// returns its address. Saved against the sponsor with the rest of the form.
export async function uploadSponsorLogo(file: File): Promise<string> {
  if (!LOGO_TYPES.includes(file.type)) throw new Error("The logo needs to be a picture - PNG, JPG, WebP, SVG or GIF.");
  if (file.size > 2 * 1024 * 1024) throw new Error("That logo is too big - it needs to be under 2 MB.");
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("sponsor-logos").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from("sponsor-logos").getPublicUrl(path).data.publicUrl;
}

// Super: every venue, A to Z
export async function listVenues(): Promise<Venue[]> {
  const { data, error } = await supabase.from("venues").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

// How many competitions and sessions use each venue
export async function venueUsage(): Promise<Map<string, number>> {
  const [{ data: comps }, { data: nights }] = await Promise.all([
    supabase.from("competitions").select("venue_id").not("venue_id", "is", null),
    supabase.from("nights").select("venue_id").not("venue_id", "is", null),
  ]);
  const used = new Map<string, number>();
  for (const r of [...(comps ?? []), ...(nights ?? [])]) used.set(r.venue_id, (used.get(r.venue_id) ?? 0) + 1);
  return used;
}

// Super: removes a venue nothing uses any more
export async function deleteVenue(id: string): Promise<void> {
  const used = (await venueUsage()).get(id) ?? 0;
  if (used > 0) throw new Error("A competition or session still uses this venue - choose another for it first.");
  const { error } = await supabase.from("venues").delete().eq("id", id);
  if (error) throw error;
}
