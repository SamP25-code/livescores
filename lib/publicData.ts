// Loads what the public pages show: every competition with its sessions
// (each with its status from its matches), entries count and champion; the
// matches being played right now; and a series' honours board. A handful of
// requests in all, however many competitions there are.
import { supabase } from "@/lib/supabaseClient";
import { computeNightStatus, roundLabel } from "@/lib/bracket";
import { distinguishedNames } from "@/lib/people";
import type { Champion, PublicCompetition, PublicSession, PublicSessionKind } from "@/lib/publicCompetitions";
import type { ClubOrganiser } from "@/lib/siteMenu";

type MatchLite = {
  id: string;
  night_id: string;
  round: number;
  slot: number;
  status: "upcoming" | "live" | "complete";
  winner_id: string | null;
  player_a_id: string | null;
  player_b_id: string | null;
  score_a: number;
  score_b: number;
};

export async function loadPublicCompetitions(): Promise<PublicCompetition[]> {
  const [comps, nights, entries] = await Promise.all([
    supabase
      .from("competitions")
      .select(
        "*, series:series_id(id, name, slug, organiser:organiser_id(*)), sponsors:competition_sponsors(*)"
      ),
    supabase
      .from("nights")
      .select(
        "*"
      )
      .not("competition_id", "is", null),
    supabase.from("entries").select("competition_id").eq("status", "entered"),
  ]);
  if (comps.error) throw comps.error;
  if (nights.error) throw nights.error;

  const nightIds = (nights.data ?? []).map((n) => n.id);
  const { data: matchData, error: matchError } = nightIds.length
    ? await supabase
        .from("matches")
        .select("id, night_id, round, slot, status, winner_id, player_a_id, player_b_id, score_a, score_b")
        .in("night_id", nightIds)
    : { data: [], error: null };
  if (matchError) throw matchError;
  const matches = (matchData ?? []) as MatchLite[];

  const byNight = new Map<string, MatchLite[]>();
  for (const m of matches) {
    if (!byNight.has(m.night_id)) byNight.set(m.night_id, []);
    byNight.get(m.night_id)!.push(m);
  }

  // Each trophy session's final, for the champion
  const finals = new Map<string, MatchLite>(); // night id -> final
  for (const n of nights.data ?? []) {
    if (n.kind === "qualifier") continue;
    const list = byNight.get(n.id) ?? [];
    if (list.length === 0) continue;
    const top = Math.max(...list.map((m) => m.round));
    const last = list.filter((m) => m.round === top);
    if (last.length === 1 && last[0].status === "complete" && last[0].winner_id) finals.set(n.id, last[0]);
  }
  const nameIds = [...finals.values()].flatMap((m) => [m.player_a_id, m.player_b_id]).filter((id): id is string => Boolean(id));
  const names = new Map<string, string>();
  const peopleOf = new Map<string, string[]>(); // place in the draw -> its people
  if (nameIds.length) {
    const { data: people } = await supabase
      .from("players")
      .select("id, name, entry:entry_id(person_id, partner_id)")
      .in("id", nameIds);
    for (const p of people ?? []) {
      names.set(p.id, p.name);
      const entry = p.entry as unknown as { person_id: string; partner_id: string | null } | null;
      if (entry) peopleOf.set(p.id, [entry.person_id, entry.partner_id].filter((x): x is string => Boolean(x)));
    }
  }

  const entryCount = new Map<string, number>();
  for (const e of entries.data ?? []) entryCount.set(e.competition_id, (entryCount.get(e.competition_id) ?? 0) + 1);

  const sessionsByComp = new Map<string, PublicSession[]>();
  for (const n of nights.data ?? []) {
    const list = byNight.get(n.id) ?? [];
    const session: PublicSession = {
      ...n,
      kind: n.kind as PublicSessionKind,
      postponed: Boolean(n.postponed),
      status: list.length ? computeNightStatus(list) : "upcoming",
      liveCount: list.filter((m) => m.status === "live").length,
      matchCount: list.length,
    };
    if (!sessionsByComp.has(n.competition_id)) sessionsByComp.set(n.competition_id, []);
    sessionsByComp.get(n.competition_id)!.push(session);
  }

  return (comps.data ?? []).map((c) => {
    const series = c.series as { name: string; slug: string; organiser: PublicCompetition["organiser"] };
    const sessions = (sessionsByComp.get(c.id) ?? []).sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0));
    let champion: Champion | null = null;
    for (const s of sessions) {
      const f = finals.get(s.id);
      if (!f) continue;
      const loser = f.winner_id === f.player_a_id ? f.player_b_id : f.player_a_id;
      champion = {
        name: names.get(f.winner_id!) ?? "Champion",
        runnerUp: loser ? (names.get(loser) ?? null) : null,
        date: s.date,
        winnerIds: peopleOf.get(f.winner_id!) ?? [],
        runnerUpIds: loser ? (peopleOf.get(loser) ?? []) : [],
      };
    }
    return {
      id: c.id,
      year: c.year,
      name: series.name,
      slug: series.slug,
      label: c.label,
      entry_method: c.entry_method,
      format: c.format,
      team_size: c.team_size,
      draw_size: c.draw_size,
      qualifying_nights: c.qualifying_nights,
      entries_per_night: c.entries_per_night,
      qualifiers_per_night: c.qualifiers_per_night,
      target_score: c.target_score,
      venue_id: c.venue_id,
      organiser: {
        id: series.organiser.id,
        name: series.organiser.name,
        short_name: series.organiser.short_name,
        kind: series.organiser.kind,
        slug: series.organiser.slug ?? null,
      },
      sponsors: [
        ...((c.sponsors as { name: string; url: string | null; logo_url?: string | null; position: number }[]) ?? []),
      ]
        .sort((a, b) => a.position - b.position)
        .map(({ name, url, logo_url }) => ({ name, url, logo_url: logo_url ?? null })),
      sessions,
      entryCount: entryCount.get(c.id) ?? 0,
      champion,
    };
  });
}

export type LiveMatch = {
  id: string;
  nightId: string;
  competitionId: string;
  roundName: string;
  nameA: string;
  nameB: string;
  scoreA: number;
  scoreB: number;
};

// Matches being played right now, in every competition
export async function loadLiveMatches(): Promise<LiveMatch[]> {
  const { data: live, error } = await supabase
    .from("matches")
    .select("id, night_id, round, slot, player_a_id, player_b_id, score_a, score_b, updated_at")
    .eq("status", "live")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!live?.length) return [];

  const nightIds = [...new Set(live.map((m) => m.night_id))];
  const playerIds = live.flatMap((m) => [m.player_a_id, m.player_b_id]).filter((id): id is string => Boolean(id));
  const [{ data: nights }, { data: players }, { data: rounds }] = await Promise.all([
    supabase.from("nights").select("id, kind, competition_id").in("id", nightIds),
    supabase.from("players").select("id, name").in("id", playerIds),
    supabase.from("matches").select("night_id, round").in("night_id", nightIds),
  ]);
  const nightById = new Map((nights ?? []).map((n) => [n.id, n]));
  const nameById = new Map((players ?? []).map((p) => [p.id, p.name as string]));
  // Matches per round, for "Quarter-Final" and the like
  const perRound = new Map<string, number>();
  for (const r of rounds ?? []) perRound.set(`${r.night_id}:${r.round}`, (perRound.get(`${r.night_id}:${r.round}`) ?? 0) + 1);

  return live.map((m) => {
    const night = nightById.get(m.night_id);
    return {
      id: m.id,
      nightId: m.night_id,
      competitionId: night?.competition_id ?? "",
      roundName: night ? roundLabel(night.kind, m.round, perRound.get(`${m.night_id}:${m.round}`) ?? 1) : `Round ${m.round}`,
      nameA: (m.player_a_id && nameById.get(m.player_a_id)) || "TBC",
      nameB: (m.player_b_id && nameById.get(m.player_b_id)) || "TBC",
      scoreA: m.score_a,
      scoreB: m.score_b,
    };
  });
}

export type HonoursRow = { year: number; winner: string; runnerUp: string | null; winnerIds: string[]; runnerUpIds: string[] };

// A competition's roll of honour: results played on the site, plus earlier
// years added by hand (honours_history). The site's own result wins.
export async function loadHonours(seriesSlug: string, fromSite: PublicCompetition[]): Promise<HonoursRow[]> {
  const rows = new Map<number, HonoursRow>();
  const { data: series } = await supabase.from("series").select("id").eq("slug", seriesSlug).maybeSingle();
  if (series) {
    const { data: history } = await supabase
      .from("honours_history")
      .select(
        "year, winner_text, runner_up_text, winner_person_id, winner_partner_id, runner_up_person_id, runner_up_partner_id, winner:winner_person_id(full_name), winnerPartner:winner_partner_id(full_name), runner:runner_up_person_id(full_name), runnerPartner:runner_up_partner_id(full_name)"
      )
      .eq("series_id", series.id);
    for (const h of history ?? []) {
      // A doubles year: "A & B"
      const nameOf = (x: unknown) => (x as { full_name: string } | null)?.full_name ?? null;
      const pair = (a: unknown, b: unknown) => [nameOf(a), nameOf(b)].filter(Boolean).join(" & ") || null;
      const winner = pair(h.winner, h.winnerPartner) ?? h.winner_text;
      const runner = pair(h.runner, h.runnerPartner) ?? h.runner_up_text;
      if (winner) {
        rows.set(h.year, {
          year: h.year,
          winner,
          runnerUp: runner ?? null,
          winnerIds: [h.winner_person_id, h.winner_partner_id].filter((x): x is string => Boolean(x)),
          runnerUpIds: [h.runner_up_person_id, h.runner_up_partner_id].filter((x): x is string => Boolean(x)),
        });
      }
    }
  }
  for (const c of fromSite) {
    if (c.slug === seriesSlug && c.champion) {
      rows.set(c.year, {
        year: c.year,
        winner: c.champion.name,
        runnerUp: c.champion.runnerUp,
        winnerIds: c.champion.winnerIds ?? [],
        runnerUpIds: c.champion.runnerUpIds ?? [],
      });
    }
  }
  return [...rows.values()].sort((a, b) => b.year - a.year);
}

export type EnteredName = { name: string; sessionId: string | null };

// Who's entered in a competition, as shown publicly: pairs as "A & B", a
// club or note only where two people share a name, and anyone who's asked to
// be taken off as "Withdrawn player". A to Z.
export async function loadEnteredNames(competitionId: string): Promise<EnteredName[]> {
  const { data, error } = await supabase
    .from("entries")
    .select(
      "session_id, partner_id, person:person_id(id, full_name, note, club:club_id(short_name)), partner:partner_id(id, full_name, note, club:club_id(short_name))"
    )
    .eq("competition_id", competitionId)
    .eq("status", "entered");
  if (error) throw error;
  type P = { id: string; full_name: string; note: string | null; club: { short_name: string } | null } | null;
  const rows = (data ?? []) as unknown as { session_id: string | null; partner_id: string | null; person: P; partner: P }[];
  const people = rows
    .flatMap((r) => [r.person, r.partner])
    .filter((p): p is NonNullable<P> => Boolean(p))
    .map((p) => ({ id: p.id, full_name: p.full_name, note: p.note, club_name: p.club?.short_name ?? null }));
  const shown = distinguishedNames(people);
  // Someone hidden for privacy can't be read publicly, so comes back empty
  const nameOf = (p: P) => (p ? (shown.get(p.id) ?? p.full_name) : "Withdrawn player");
  return rows
    .map((r) => ({
      name: r.partner_id ? `${nameOf(r.person)} & ${nameOf(r.partner)}` : nameOf(r.person),
      sessionId: r.session_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Every club, for the Clubs page and the menu's search - including a venue
// ticked "also a club" that doesn't run a competition yet
export async function loadClubOrganisers(): Promise<ClubOrganiser[]> {
  const { data, error } = await supabase.from("organisers").select("id, name, short_name, slug, venue_id").eq("kind", "club");
  if (error) throw error;
  return (data ?? []) as ClubOrganiser[];
}
