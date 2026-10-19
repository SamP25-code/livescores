// Correcting a finished result. The rules (agreed 2026-10-16):
//   - an admin can correct any finished result, and every correction is logged
//   - whatever the result fed updates too: the next round's player, the
//     champion (worked out from the final), and the Finals Day place a
//     qualifying session's winner went through to
//   - if the next round has already started with the wrong player, the admin
//     is warned and decides; if it's already finished, later results have to
//     be put right first (reopen them, latest first)
import { resultEntry, type Side } from "@/lib/scoreQueue";

type Played = { status: string; score_a: number; score_b: number };

export type CorrectionPlan = {
  winner: Side;
  winnerChanged: boolean;
  // The next round's match: nothing to do, put the new winner in, or put
  // them in and start that match again at 0-0
  next: "none" | "swap" | "swap_and_restart";
  // A qualifying session's winner already gone through to Finals Day
  finals: "none" | "move";
  // Ask before going ahead (the next match has started)
  confirm: string | null;
  // Can't be done as it stands
  blocked: string | null;
};

export function planCorrection(input: {
  match: Played & { target_score: number; winner_side: Side | null };
  scoreA: number;
  scoreB: number;
  names: { a: string; b: string };
  nextMatch: Played | null;
  // Qualifying session's last round: their Finals Day place, if they have one
  finalsPlace: { played: boolean } | null;
}): CorrectionPlan {
  const { match, scoreA, scoreB, names, nextMatch, finalsPlace } = input;
  const result = resultEntry(match, scoreA, scoreB);
  if (result.status !== "complete" || !result.winner_side) {
    throw new Error(`A corrected result needs a winner - someone has to reach ${match.target_score}.`);
  }
  const winner = result.winner_side;
  const winnerChanged = winner !== match.winner_side;
  const plan: CorrectionPlan = { winner, winnerChanged, next: "none", finals: "none", confirm: null, blocked: null };
  if (!winnerChanged) return plan;

  const wrong = match.winner_side === "a" ? names.a : names.b;
  const right = winner === "a" ? names.a : names.b;

  if (nextMatch) {
    const started = nextMatch.status !== "upcoming" || nextMatch.score_a > 0 || nextMatch.score_b > 0;
    if (nextMatch.status === "complete") {
      plan.blocked = `${wrong} has already finished their next match. Reopen the later matches first (latest first), then correct this one.`;
    } else if (started) {
      plan.next = "swap_and_restart";
      plan.confirm = `${wrong} has already started their next match (${nextMatch.score_a}-${nextMatch.score_b}). Changing the result puts ${right} in their place and starts that match again at 0-0.`;
    } else {
      plan.next = "swap";
    }
  }

  if (finalsPlace) {
    if (finalsPlace.played) {
      plan.blocked = `${wrong} has already played on Finals Day, so this result can't change who went through.`;
    } else {
      plan.finals = "move";
    }
  }
  return plan;
}
