// Scoring with poor signal. Every score tap (and every result typed in) is
// kept on the phone first and shown straight away, then sent in order as soon
// as there's signal. Nothing is lost if the signal drops or the page is
// closed - waiting scores are kept in the phone's storage and sent next time.
//
// Each waiting score remembers the score it was made from. It's only applied
// if the match still has that score, so a match changed on another phone in
// the meantime is never overwritten - the scorer is asked to check it.
//
// This file is the rules and the waiting list; lib/scoreSync.ts sends them.

export type Side = "a" | "b";
export type MatchStatus = "upcoming" | "live" | "complete";

export type ScoreState = { score_a: number; score_b: number; status: MatchStatus };
export type ScoreResult = ScoreState & { winner_side: Side | null };

export type ScoreOp = {
  id: string;
  nightId: string;
  matchId: string;
  kind: "tap" | "result";
  at: string; // when it was tapped
  playerA: string | null;
  playerB: string | null;
  // The winner before this change (results can change who won)
  prevWinnerId: string | null;
  prev: ScoreState;
  next: ScoreResult;
};

type MatchLike = ScoreState & {
  id: string;
  night_id: string;
  target_score: number;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_id: string | null;
};

function reached(score_a: number, score_b: number, target: number): Side | null {
  if (score_a < target && score_b < target) return null;
  return score_a > score_b ? "a" : "b";
}

// A +1 / +2 / - tap: the new score, live once started, finished (with a
// winner) as soon as someone reaches the target. null if nothing changes.
export function tapResult(m: ScoreState & { target_score: number }, side: Side, delta: number): ScoreResult | null {
  const current = side === "a" ? m.score_a : m.score_b;
  const value = Math.min(m.target_score, Math.max(0, current + delta));
  if (value === current) return null;
  const score_a = side === "a" ? value : m.score_a;
  const score_b = side === "b" ? value : m.score_b;
  const winner = reached(score_a, score_b, m.target_score);
  return {
    score_a,
    score_b,
    status: winner ? "complete" : m.status === "upcoming" ? "live" : m.status === "complete" ? "live" : m.status,
    winner_side: winner,
  };
}

// A score typed in for a results-only match. Short of the target it's the
// score so far (live); reaching it finishes the match. Throws if it can't be.
export function resultEntry(m: { target_score: number }, score_a: number, score_b: number): ScoreResult {
  if (!Number.isInteger(score_a) || !Number.isInteger(score_b) || score_a < 0 || score_b < 0) {
    throw new Error("Scores can't be negative.");
  }
  if (score_a > m.target_score || score_b > m.target_score) {
    throw new Error(`Scores can't be higher than ${m.target_score}.`);
  }
  const winner = reached(score_a, score_b, m.target_score);
  if (winner && score_a === score_b) {
    throw new Error("Scores can't be level once someone's reached the target - there has to be a winner.");
  }
  return { score_a, score_b, status: winner ? "complete" : "live", winner_side: winner };
}

// The match as the scorer should see it: the latest waiting score, if any
export function displayMatch<M extends MatchLike>(m: M, ops: ScoreOp[]): M {
  let latest: ScoreOp | null = null;
  for (const op of ops) if (op.matchId === m.id) latest = op;
  if (!latest) return m;
  const { score_a, score_b, status, winner_side } = latest.next;
  return {
    ...m,
    score_a,
    score_b,
    status,
    winner_id: winner_side === "a" ? m.player_a_id : winner_side === "b" ? m.player_b_id : null,
  };
}

// Builds the waiting score for a tap or a typed result on the match as the
// scorer sees it now (which already includes any earlier waiting scores)
export function makeOp(
  m: MatchLike,
  kind: ScoreOp["kind"],
  next: ScoreResult,
  id: string = randomId(),
  at: string = new Date().toISOString()
): ScoreOp {
  return {
    id,
    nightId: m.night_id,
    matchId: m.id,
    kind,
    at,
    playerA: m.player_a_id,
    playerB: m.player_b_id,
    prevWinnerId: m.winner_id,
    prev: { score_a: m.score_a, score_b: m.score_b, status: m.status },
    next,
  };
}

export function winnerIdOf(op: ScoreOp): string | null {
  return op.next.winner_side === "a" ? op.playerA : op.next.winner_side === "b" ? op.playerB : null;
}

// No signal (or the server couldn't be reached) - as opposed to the server
// refusing the change, which waiting and retrying won't fix
export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: unknown; status?: unknown; name?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  return (
    e.status === 0 ||
    e.name === "TypeError" ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|offline/i.test(message)
  );
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// The waiting list, kept in the phone's storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = "bowls-score-queue-v1";

export function loadOps(): ScoreOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOps(ops: ScoreOp[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    // Storage unavailable (private browsing) - they're still held in memory
  }
}
