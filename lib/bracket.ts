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

export function roundLabel(
  kind: "qualifier" | "finals",
  round: number,
  matchesInRound: number
): string {
  if (kind === "qualifier") return `Round ${round}`;
  return roundName(matchesInRound * 2);
}

export function isMatchComplete(match: ScoredMatch): boolean {
  return match.score_a >= match.target_score || match.score_b >= match.target_score;
}

export function getWinnerSide(match: ScoredMatch): "a" | "b" | null {
  if (!isMatchComplete(match)) return null;
  return match.score_a > match.score_b ? "a" : "b";
}

export function getWinnerId(match: Match): string | null {
  const side = getWinnerSide(match);
  if (!side) return null;
  return side === "a" ? match.player_a_id : match.player_b_id;
}

export function totalRounds(playerCount: number): number {
  return Math.ceil(Math.log2(playerCount));
}

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

export function nextPowerOfTwo(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

export function buildByeSlots<T extends { id: string }>(players: T[]): Array<T | null> {
  const drawSize = nextPowerOfTwo(players.length);
  const numPairs = drawSize / 2;
  const byeCount = drawSize - players.length;

  const slots: Array<T | null> = [];
  let next = 0;
  for (let pair = 0; pair < numPairs; pair++) {
    const isByePair = pair >= numPairs - byeCount;
    slots.push(players[next++]);
    slots.push(isByePair ? null : players[next++]);
  }
  return slots;
}

export function buildQualifierSlots<T extends { id: string; is_bye?: boolean }>(
  players: T[]
): Array<T | null> {
  const slots: Array<T | null> = players.map((p) => (p.is_bye ? null : p));
  const drawSize = nextPowerOfTwo(slots.length);
  const extra = drawSize - slots.length;
  if (extra > 0) slots.push(...(Array(extra).fill(null) as null[]));
  return slots;
}

export const FINALS_DRAW_SIZE = 16;

export type SeededPlayer = { id: string; name: string; seed: number | null };

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

export function roundOneSlotForSeed(seed: number): { slot: number; side: "a" | "b" } {
  const index = seed - 1;
  return { slot: Math.floor(index / 2), side: index % 2 === 0 ? "a" : "b" };
}

export type NightStatus = "upcoming" | "live" | "complete";

export function computeNightStatus(matches: Array<{ round: number; status: string }>): NightStatus {
  if (matches.length === 0) return "upcoming";
  const lastRound = Math.max(...matches.map((m) => m.round));
  const lastRoundMatches = matches.filter((m) => m.round === lastRound);
  if (lastRoundMatches.every((m) => m.status === "complete")) return "complete";
  return matches.some((m) => m.status !== "upcoming") ? "live" : "upcoming";
}
