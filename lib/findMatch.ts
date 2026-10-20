// "Find your match" on a session's public page: type your name, see where you
// are - playing now, your next match and its time, through and waiting, or
// knocked out.

type M = {
  id: string;
  round: number;
  slot: number;
  status: string;
  player_a_id: string | null;
  player_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_id: string | null;
};

export type YourMatch = {
  matchId: string;
  // "Live now · 14-9", "10:45", "Won 21-15", "Lost 15-21"...
  headline: string;
  opponent: string | null;
  round: string;
};

// The match that matters most for this player: the one being played, else
// their next one, else the last one they played
export function yourMatch<T extends M>(
  playerId: string,
  matches: T[],
  names: Record<string, string>,
  roundName: (m: T) => string,
  startTime: (m: T) => string | null
): YourMatch | null {
  const theirs = matches
    .filter((m) => m.player_a_id === playerId || m.player_b_id === playerId)
    .sort((a, b) => a.round - b.round);
  if (theirs.length === 0) return null;
  const live = theirs.find((m) => m.status === "live");
  const next = theirs.find((m) => m.status === "upcoming");
  const pick = live ?? next ?? theirs[theirs.length - 1];
  const isA = pick.player_a_id === playerId;
  const otherId = isA ? pick.player_b_id : pick.player_a_id;
  const mine = isA ? pick.score_a : pick.score_b;
  const theirsScore = isA ? pick.score_b : pick.score_a;
  const opponent = otherId ? (names[otherId] ?? null) : null;

  let headline: string;
  if (pick.status === "live") headline = `Live now · ${mine}-${theirsScore}`;
  else if (pick.status === "upcoming") headline = startTime(pick) ?? (opponent ? "Up next" : "Through - opponent to be decided");
  else if (!pick.player_a_id || !pick.player_b_id) headline = "Through with a bye";
  else if (pick.winner_id === playerId) headline = mine === 0 && theirsScore === 0 ? "Through - walkover" : `Won ${mine}-${theirsScore}`;
  else headline = mine === 0 && theirsScore === 0 ? "Didn't play (walkover)" : `Lost ${mine}-${theirsScore}`;

  return { matchId: pick.id, headline, opponent, round: roundName(pick) };
}
