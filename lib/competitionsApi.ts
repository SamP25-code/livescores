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

export type SessionDetails = {
  date: string | null;
  start_time: string | null;
  practice_time: string | null;
  // A county competition's sessions each have their own venue; left out
  // (undefined), a session's venue isn't touched
  venue_id?: string | null;
};

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
  // A club comes with its green - the address and map link, filled in on Clubs
  let venue_id: string | null = null;
  if (o.kind === "club") {
    const { data: venue, error: venueError } = await supabase.from("venues").insert({ name: o.name }).select().single();
    if (venueError) throw venueError;
    venue_id = venue.id;
  }
  const { data, error } = await supabase
    .from("organisers")
    .insert({ ...o, slug: slug || null, ...(venue_id ? { venue_id } : {}) })
    .select()
    .single();
  if (error) {
    if (venue_id) await supabase.from("venues").delete().eq("id", venue_id);
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
      ...(details[i] && "venue_id" in details[i] ? { venue_id: details[i].venue_id || null } : {}),
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

// Every club with its green (Clubs, in admin)
export type ClubWithGreen = Organiser & { venue: Venue | null };
export async function listClubsWithGreens(): Promise<ClubWithGreen[]> {
  const { data, error } = await supabase.from("organisers").select("*, venue:venue_id(*)").eq("kind", "club").order("name");
  if (error) throw error;
  return (data ?? []) as ClubWithGreen[];
}

// Super: a club and its green, new or changed together
export async function saveClub(
  club: ClubWithGreen | null,
  details: { name: string; short_name: string } & VenueInput
): Promise<void> {
  const { name, short_name, ...green } = details;
  if (!club) {
    const created = await createOrganiser({ name, short_name, kind: "club" });
    if (created.venue_id) await updateVenue(created.venue_id, { ...green, name });
    return;
  }
  const { error } = await supabase.from("organisers").update({ name, short_name }).eq("id", club.id);
  if (error) throw error;
  if (club.venue_id) {
    await updateVenue(club.venue_id, { ...green, name });
  } else {
    const venue = await createVenue({ ...green, name });
    const { error: linkError } = await supabase.from("organisers").update({ venue_id: venue.id }).eq("id", club.id);
    if (linkError) throw linkError;
  }
}

// Super: removes a club nothing is played at and that runs nothing
export async function deleteClub(club: ClubWithGreen): Promise<void> {
  if (club.venue_id && ((await venueUsage()).get(club.venue_id) ?? 0) > 0) {
    throw new Error("A competition or session is played there - choose another club for it first.");
  }
  await deleteOrganiser(club.id);
  if (club.venue_id) await supabase.from("venues").delete().eq("id", club.venue_id);
}

// Super: removes a venue nothing uses any more
export async function deleteVenue(id: string): Promise<void> {
  const used = (await venueUsage()).get(id) ?? 0;
  if (used > 0) throw new Error("A competition or session still uses this venue - choose another for it first.");
  const { error } = await supabase.from("venues").delete().eq("id", id);
  if (error) throw error;
}

// Super: renames a competition - every year of it, and its honours board.
// Its web address stays the same, so links already shared keep working.
export async function renameSeries(seriesId: string, name: string): Promise<void> {
  if (!name.trim()) throw new Error("Enter the competition's name.");
  const { error } = await supabase.from("series").update({ name: name.trim() }).eq("id", seriesId);
  if (error) throw error;
}

// Super: moves a competition (every year of it) to a different club or event
export async function moveSeries(seriesId: string, organiserId: string): Promise<void> {
  const { error } = await supabase.from("series").update({ organiser_id: organiserId }).eq("id", seriesId);
  if (error) throw error;
}

// Super: removes a competition set up by mistake - only while nothing's
// happened in it (no entries, no scores). Its sessions go with it, and the
// competition's name too if no other year of it is left.
export async function deleteCompetition(competition: { id: string; series_id: string }): Promise<void> {
  const [{ count: entries }, { data: nights }] = await Promise.all([
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("competition_id", competition.id),
    supabase.from("nights").select("id").eq("competition_id", competition.id),
  ]);
  if ((entries ?? 0) > 0) throw new Error("It has entries - remove them first, so nothing's lost by mistake.");
  const nightIds = (nights ?? []).map((n) => n.id);
  if (nightIds.length) {
    const { count: played } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("night_id", nightIds)
      .neq("status", "upcoming");
    if ((played ?? 0) > 0) throw new Error("It has scores - it can't be removed.");
  }
  const { error } = await supabase.from("competitions").delete().eq("id", competition.id);
  if (error) {
    if (error.code === "23503") throw new Error("Another competition uses it as a qualifying place - take that out first.");
    throw error;
  }
  const { count: years } = await supabase
    .from("competitions")
    .select("id", { count: "exact", head: true })
    .eq("series_id", competition.series_id);
  if ((years ?? 0) === 0) await supabase.from("series").delete().eq("id", competition.series_id);
}

// Super: removes a club or event with no competitions left (its posts go too)
export async function deleteOrganiser(id: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from("series")
    .select("id", { count: "exact", head: true })
    .eq("organiser_id", id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) throw new Error("It still has competitions - move or remove them first.");
  await supabase.from("people").update({ club_id: null }).eq("club_id", id);
  const { error } = await supabase.from("organisers").delete().eq("id", id);
  if (error) throw error;
}
