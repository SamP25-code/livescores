// Pure, framework-free bracket helpers.
// Kept separate from any Supabase/network code so they're trivial to unit test.
// Field names match the `matches` table columns (snake_case) so these
// functions can be called directly with rows from Supabase.

export type ScoredMatch = {
  score_a: number;
  score_b: number;
  target_score: number;
};

export type Match = ScoredMatch & {
  id: string;
  round: number;
  slot: number;
  player_a_id: string | null;
  player_b_id: string | null;
  status: "upcoming" | "live" | "complete";
  winner_id: string | null;
};

/**
 * Human-readable name for a round, based on how many players started that
 * round (16 -> "Round of 16", 8 -> "Quarter-Final", 4 -> "Semi-Final",
 * 2 -> "Final").
 */
export function roundName(playersInRound: number): string {
  switch (playersInRound) {
    case 2:
      return "Final";
    case 4:
      return "Semi-Final";
    case 8:
      return "Quarter-Final";
    default:
      return `Round of ${playersInRound}`;
  }
}

/**
 * Label for a round, given the night's kind. Qualifying nights always play
 * exactly 2 rounds (16 -> 8 -> 4 winners advancing to finals day) and are
 * labelled plainly "Round 1" / "Round 2". Finals day is a knockout to a
 * single winner, so it keeps the descriptive naming above.
 */
export function roundLabel(
  kind: "qualifier" | "finals",
  round: number,
  matchesInRound: number
): string {
  if (kind === "qualifier") return `Round ${round}`;
  return roundName(matchesInRound * 2);
}

/**
 * A match is decided as soon as either side reaches the target score
 * (single game to 21, straight knockout - no need to win by two).
 */
export function isMatchComplete(match: ScoredMatch): boolean {
  return match.score_a >= match.target_score || match.score_b >= match.target_score;
}

/**
 * Returns "a", "b", or null (not decided yet).
 */
export function getWinnerSide(match: ScoredMatch): "a" | "b" | null {
  if (!isMatchComplete(match)) return null;
  return match.score_a > match.score_b ? "a" : "b";
}

/**
 * Given a completed match, return the id of the winning player (or null if
 * the match isn't finished, or a side has no player assigned yet).
 */
export function getWinnerId(match: Match): string | null {
  const side = getWinnerSide(match);
  if (!side) return null;
  return side === "a" ? match.player_a_id : match.player_b_id;
}

/**
 * How many rounds a knockout of N players needs (16 -> 4 rounds, 8 -> 3, etc).
 * Assumes N is a power of two.
 */
export function totalRounds(playerCount: number): number {
  return Math.ceil(Math.log2(playerCount));
}

/**
 * Build the empty round-1 slots for a knockout of N players, pairing them in
 * the order given. Returns pairs of indices into the players array.
 */
export function firstRoundPairs(playerCount: number): Array<[number, number]> {
  if (playerCount % 2 !== 0) {
    throw new Error("playerCount must be even");
  }
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < playerCount; i += 2) {
    pairs.push([i, i + 1]);
  }
  return pairs;
}

/** Total finals-day draw size: 4 qualifying nights x 4 winners each. */
export const FINALS_DRAW_SIZE = 16;

export type SeededPlayer = { id: string; name: string; seed: number | null };

/**
 * Lays out a fixed-size draw (1..size) with whichever players have claimed a
 * seat so far, leaving the rest as empty slots. Used to show the finals-day
 * lineup filling in over several qualifying nights, before every seat (and
 * the bracket itself) is settled.
 */
export function buildFinalsSlots<T extends SeededPlayer>(
  players: T[],
  size: number = FINALS_DRAW_SIZE
): Array<T | null> {
  const bySeed = new Map<number, T>();
  for (const p of players) {
    if (p.seed != null) bySeed.set(p.seed, p);
  }
  return Array.from({ length: size }, (_, i) => bySeed.get(i + 1) ?? null);
}

/**
 * Which round-1 match a finals-day draw number feeds into, and which side of
 * it - mirrors how firstRoundPairs pairs consecutive draw positions
 * (1 v 2, 3 v 4, ...). Used to drop a player straight into their match slot
 * the moment they're given a number, without regenerating the bracket.
 */
export function roundOneSlotForSeed(seed: number): { slot: number; side: "a" | "b" } {
  const index = seed - 1;
  return { slot: Math.floor(index / 2), side: index % 2 === 0 ? "a" : "b" };
}

export type NightStatus = "upcoming" | "live" | "complete";

/**
 * A night's overall status, derived from its matches rather than a stored
 * flag nobody ever sets: "upcoming" before the draw's been played, "live"
 * once any match has started, "complete" once the last round is finished
 * (a qualifying night's round 2, or finals day's final).
 */
export function computeNightStatus(matches: Array<{ round: number; status: string }>): NightStatus {
  if (matches.length === 0) return "upcoming";
  const lastRound = Math.max(...matches.map((m) => m.round));
  const lastRoundMatches = matches.filter((m) => m.round === lastRound);
  if (lastRoundMatches.every((m) => m.status === "complete")) return "complete";
  return matches.some((m) => m.status !== "upcoming") ? "live" : "upcoming";
}
