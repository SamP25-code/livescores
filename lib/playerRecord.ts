// A player's page, worked out from what's in the database: every competition
// they've entered (with their partner, for doubles), each match they've
// played or have coming up, and what they've won. Pure - the loading is in
// lib/playerData.ts.
import { isWalkover, roundLabel, roundName } from "@/lib/bracket";
import { rowState, type PublicCompetition, type PublicSession, type RowState } from "@/lib/publicCompetitions";

export type RecordEntry = { id: string; competition_id: string; person_id: string; partner_id: string | null; status: string };
export type RecordPlace = { id: string; night_id: string; entry_id: string | null };
export type RecordMatch = {
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
// A past year added by hand to an honours board, naming this person
export type RecordHonour = { year: number; seriesName: string; seriesSlug: string; place: "Winner" | "Runner-up" };

export type PlayerMatch = {
  id: string;
  session: PublicSession;
  round: string;
  roundNumber: number;
  opponent: string;
  // The people behind the opponent's name (a pair: both), for their pages
  opponentIds: string[];
  mine: number;
  theirs: number;
  // "won" / "lost" once played; "walkover" when they won because the other
  // side didn't turn up; "live" or "upcoming" otherwise
  result: "won" | "lost" | "walkover" | "live" | "upcoming";
};

export type PlayerCompetition = {
  competition: PublicCompetition;
  partner: string | null;
  state: RowState;
  finish: "Winner" | "Runner-up" | null;
  matches: PlayerMatch[];
};

// href: the competition (by id) whose results are on the site, or null for
// a year added by hand to an honours board
export type PlayerTitle = { place: "Winner" | "Runner-up"; name: string; year: number; href: string | null; partner: string | null };

export type PlayerRecord = {
  competitions: PlayerCompetition[];
  titles: PlayerTitle[];
  played: number;
  won: number;
};

export function buildPlayerRecord({
  personId,
  entries,
  places,
  matches,
  names,
  peopleOf = new Map(),
  competitions,
  honours,
  today,
}: {
  personId: string;
  entries: RecordEntry[];
  places: RecordPlace[];
  matches: RecordMatch[];
  // Names for every person and place that comes up: person ids (for
  // partners) and place ids (for opponents, "A & B" for a pair)
  names: Map<string, string>;
  // Each opponent's place in the draw -> the people in it
  peopleOf?: Map<string, string[]>;
  competitions: PublicCompetition[];
  honours: RecordHonour[];
  today: string;
}): PlayerRecord {
  const compById = new Map(competitions.map((c) => [c.id, c]));
  const sessionById = new Map(competitions.flatMap((c) => c.sessions.map((s) => [s.id, s] as const)));
  const byNight = new Map<string, RecordMatch[]>();
  for (const m of matches) {
    if (!byNight.has(m.night_id)) byNight.set(m.night_id, []);
    byNight.get(m.night_id)!.push(m);
  }

  const out: PlayerCompetition[] = [];
  const titles: PlayerTitle[] = [];
  let played = 0;
  let won = 0;

  for (const entry of entries) {
    const competition = compById.get(entry.competition_id);
    if (!competition || entry.status === "withdrawn") continue;
    const partnerId = entry.person_id === personId ? entry.partner_id : entry.person_id;
    const partner = partnerId ? (names.get(partnerId) ?? null) : null;
    const mine = new Set(places.filter((p) => p.entry_id === entry.id).map((p) => p.id));

    const list: PlayerMatch[] = [];
    let finish: PlayerCompetition["finish"] = null;
    for (const m of matches) {
      const side = m.player_a_id && mine.has(m.player_a_id) ? "a" : m.player_b_id && mine.has(m.player_b_id) ? "b" : null;
      if (!side) continue;
      const session = sessionById.get(m.night_id);
      if (!session) continue;
      const otherId = side === "a" ? m.player_b_id : m.player_a_id;
      // A bye isn't a match
      if (!otherId && m.status === "complete") continue;
      const mineScore = side === "a" ? m.score_a : m.score_b;
      const theirScore = side === "a" ? m.score_b : m.score_a;
      const iWon = m.winner_id != null && m.winner_id === (side === "a" ? m.player_a_id : m.player_b_id);
      const walkover = isWalkover(m);
      const result: PlayerMatch["result"] =
        m.status === "complete" ? (walkover ? (iWon ? "walkover" : "lost") : iWon ? "won" : "lost") : m.status;
      const inRound = (byNight.get(m.night_id) ?? []).filter((x) => x.round === m.round).length;
      list.push({
        id: m.id,
        session,
        round: playerRound(competition, session, m.round, inRound),
        roundNumber: m.round,
        opponent: otherId ? (names.get(otherId) ?? "TBC") : "TBC",
        opponentIds: otherId ? (peopleOf.get(otherId) ?? []) : [],
        mine: mineScore,
        theirs: theirScore,
        result,
      });
      if (m.status === "complete" && !walkover) {
        played++;
        if (iWon) won++;
      }
      // The final of a trophy day: champion or runner-up
      if (session.kind !== "qualifier" && m.status === "complete") {
        const top = Math.max(...(byNight.get(m.night_id) ?? []).map((x) => x.round));
        if (m.round === top && inRound === 1) finish = iWon ? "Winner" : "Runner-up";
      }
    }
    // Newest first, and within a session the latest round first
    list.sort(
      (a, b) =>
        (b.session.date ?? "").localeCompare(a.session.date ?? "") ||
        (b.session.session_number ?? 0) - (a.session.session_number ?? 0) ||
        b.roundNumber - a.roundNumber
    );
    out.push({ competition, partner, state: rowState(competition, today), finish, matches: list });
    // Played here: its page has the results
    if (finish) titles.push({ place: finish, name: competition.name, year: competition.year, href: competition.id, partner });
  }

  // Years added by hand, unless the site already has them
  for (const h of honours) {
    if (titles.some((t) => t.name === h.seriesName && t.year === h.year)) continue;
    // A year added by hand: no results on the site to open
    titles.push({ place: h.place, name: h.seriesName, year: h.year, href: null, partner: null });
  }
  titles.sort((a, b) => b.year - a.year || (a.place === "Winner" ? -1 : 1));

  out.sort((a, b) => latestDate(b).localeCompare(latestDate(a)) || b.competition.year - a.competition.year);
  return { competitions: out, titles, played, won };
}

function latestDate(c: PlayerCompetition): string {
  return c.competition.sessions.map((s) => s.date ?? "").sort().at(-1) ?? "";
}

// The round, named across the whole competition: four qualifying sessions
// of 16 make 64 players, so a session's first round is the Round of 64 and
// its second the Round of 32, then Finals Day carries on from the Round of 16
function playerRound(competition: PublicCompetition, session: PublicSession, round: number, matchesInRound: number): string {
  if (session.kind !== "qualifier") return roundLabel(session.kind, round, matchesInRound);
  const sessions = competition.qualifying_nights ?? competition.sessions.filter((s) => s.kind === "qualifier").length;
  const perSession = competition.entries_per_night ?? matchesInRound * 2 ** round;
  const left = (sessions * perSession) / 2 ** (round - 1);
  return Number.isInteger(left) && left >= 2 ? roundName(left) : `Round ${round}`;
}
