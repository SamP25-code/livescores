// Loads what the public pages show: every competition with its sessions
// (each with its status from its matches), entries count and champion; the
// matches being played right now; and a series' honours board. A handful of
// requests in all; each session's status comes ready-worked-out from the
// database (night_summaries), so it doesn't need every match ever played.
import { supabase } from "@/lib/supabaseClient";
import { roundLabel } from "@/lib/bracket";
import type { Champion, PublicCompetition, PublicSession, PublicSessionKind } from "@/lib/publicCompetitions";
import type { ClubOrganiser } from "@/lib/siteMenu";

// Every row of a table, a page of 1,000 at a time - the database hands back
// at most 1,000 at once, and a season soon has more than that
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

// A long list of ids, asked for 100 at a time so the request stays short
async function inChunks<T>(ids: string[], fetch: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await fetch(ids.slice(i, i + 100));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

// Each session's summary, worked out by the database (migration 2027_18)
type NightSummary = {
  night_id: string;
  match_count: number;
  live_count: number;
  status: "upcoming" | "live" | "complete";
  final_winner_id: string | null;
  final_loser_id: string | null;
};

// The same, shared for half a minute: moving between pages (and opening the
// menu) uses one copy rather than loading everything again each time. The
// home page loads fresh, and its copy is shared too.
let shared: { at: number; data: Promise<PublicCompetition[]> } | null = null;
export function loadPublicCompetitionsShared(): Promise<PublicCompetition[]> {
  if (shared && Date.now() - shared.at < 30_000) return shared.data;
  const data = loadPublicCompetitions();
  shared = { at: Date.now(), data };
  data.catch(() => {
    if (shared?.data === data) shared = null;
  });
  return data;
}

export async function loadPublicCompetitions(): Promise<PublicCompetition[]> {
  const fresh = loadPublicCompetitionsFresh();
  shared = { at: Date.now(), data: fresh };
  fresh.catch(() => {
    if (shared?.data === fresh) shared = null;
  });
  return fresh;
}

async function loadPublicCompetitionsFresh(): Promise<PublicCompetition[]> {
  const [comps, nights, summaries, counts] = await Promise.all([
    allRows((from, to) =>
      supabase
        .from("competitions")
        .select("*, series:series_id(id, name, slug, organiser:organiser_id(*)), sponsors:competition_sponsors(*)")
        .order("id")
        .range(from, to)
    ),
    allRows((from, to) => supabase.from("nights").select("*").not("competition_id", "is", null).order("id").range(from, to)),
    allRows<NightSummary>((from, to) => supabase.from("night_summaries").select("*").order("night_id").range(from, to)),
    allRows<{ competition_id: string; entered: number }>((from, to) =>
      supabase.from("competition_entry_counts").select("*").order("competition_id").range(from, to)
    ),
  ]);
  const summaryOf = new Map(summaries.map((x) => [x.night_id, x]));
  const entryCount = new Map(counts.map((x) => [x.competition_id, x.entered]));

  // Each trophy session's final, for the champion and runner-up: their names
  // and the people behind them
  const finals = new Map<string, NightSummary>(); // night id -> its summary
  for (const n of nights) {
    const sum = summaryOf.get(n.id);
    if (n.kind !== "qualifier" && sum?.final_winner_id) finals.set(n.id, sum);
  }
  const nameIds = [...new Set([...finals.values()].flatMap((f) => [f.final_winner_id, f.final_loser_id]).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  const peopleOf = new Map<string, string[]>(); // place in the draw -> its people
  const places = await inChunks(nameIds, (chunk) =>
    supabase.from("players").select("id, name, entry:entry_id(person_id, partner_id)").in("id", chunk)
  );
  for (const p of places as { id: string; name: string; entry: unknown }[]) {
    names.set(p.id, p.name);
    const entry = p.entry as { person_id: string; partner_id: string | null } | null;
    if (entry) peopleOf.set(p.id, [entry.person_id, entry.partner_id].filter((x): x is string => Boolean(x)));
  }

  const sessionsByComp = new Map<string, PublicSession[]>();
  for (const n of nights) {
    const sum = summaryOf.get(n.id);
    const session: PublicSession = {
      ...n,
      kind: n.kind as PublicSessionKind,
      postponed: Boolean(n.postponed),
      status: sum?.status ?? "upcoming",
      liveCount: sum?.live_count ?? 0,
      matchCount: sum?.match_count ?? 0,
    };
    if (!sessionsByComp.has(n.competition_id)) sessionsByComp.set(n.competition_id, []);
    sessionsByComp.get(n.competition_id)!.push(session);
  }

  return comps.map((c) => {
    const series = (c as { series: unknown }).series as { name: string; slug: string; organiser: PublicCompetition["organiser"] };
    const sessions = (sessionsByComp.get(c.id) ?? []).sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0));
    let champion: Champion | null = null;
    for (const s of sessions) {
      const f = finals.get(s.id);
      if (!f?.final_winner_id) continue;
      const loser = f.final_loser_id;
      champion = {
        name: names.get(f.final_winner_id) ?? "Winner",
        runnerUp: loser ? (names.get(loser) ?? null) : null,
        date: s.date,
        winnerIds: peopleOf.get(f.final_winner_id) ?? [],
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
        background_image: (series.organiser as { background_image?: string | null }).background_image ?? null,
      },
      background_url: (c as { background_url?: string | null }).background_url ?? null,
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
  const [nightsRes, playersRes, roundsRes] = await Promise.all([
    supabase.from("nights").select("id, kind, competition_id").in("id", nightIds),
    supabase.from("players").select("id, name").in("id", playerIds),
    supabase.from("matches").select("night_id, round").in("night_id", nightIds),
  ]);
  for (const r of [nightsRes, playersRes, roundsRes]) if (r.error) throw r.error;
  const nights = nightsRes.data;
  const players = playersRes.data;
  const rounds = roundsRes.data;
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
  const { data: series, error: seriesError } = await supabase.from("series").select("id").eq("slug", seriesSlug).maybeSingle();
  if (seriesError) throw seriesError;
  if (series) {
    const { data: history, error: historyError } = await supabase
      .from("honours_history")
      .select(
        "year, winner_text, runner_up_text, winner_person_id, winner_partner_id, runner_up_person_id, runner_up_partner_id, winner:winner_person_id(full_name), winnerPartner:winner_partner_id(full_name), runner:runner_up_person_id(full_name), runnerPartner:runner_up_partner_id(full_name)"
      )
      .eq("series_id", series.id);
    if (historyError) throw historyError;
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

// Every club, for the Clubs page and the menu's search - including a venue
// ticked "also a club" that doesn't run a competition yet
export async function loadClubOrganisers(): Promise<ClubOrganiser[]> {
  const { data, error } = await supabase.from("organisers").select("id, name, short_name, slug, venue_id").eq("kind", "club");
  if (error) throw error;
  return (data ?? []) as ClubOrganiser[];
}
