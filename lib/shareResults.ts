// "Share results": a session's or a competition's results as plain text, to
// paste into WhatsApp or Facebook - the latest round first, so the final
// (and the champion) are at the top, then a link to the full draw.
import { isWalkover, roundLabel } from "@/lib/bracket";

type Kind = "qualifier" | "finals" | "single_day" | "final";

export type ShareMatch = {
  round: number;
  slot: number;
  status: "upcoming" | "live" | "complete";
  player_a_id: string | null;
  player_b_id: string | null;
  score_a: number;
  score_b: number;
  winner_id: string | null;
};

// One match as a line: the winner first once it's played
export function matchLine(m: ShareMatch, names: Record<string, string>): string | null {
  const a = m.player_a_id ? (names[m.player_a_id] ?? "TBC") : null;
  const b = m.player_b_id ? (names[m.player_b_id] ?? "TBC") : null;
  if (!a || !b) return null; // a bye, or not drawn yet
  if (isWalkover(m)) {
    const aWon = m.winner_id === m.player_a_id;
    return `${aWon ? a : b} - walkover (${aWon ? b : a} didn't play)`;
  }
  if (m.status === "complete") {
    const aWon = m.winner_id === m.player_a_id;
    return aWon ? `${a} ${m.score_a}–${m.score_b} ${b}` : `${b} ${m.score_b}–${m.score_a} ${a}`;
  }
  if (m.status === "live") return `${a} ${m.score_a}–${m.score_b} ${b} (in play)`;
  return `${a} v ${b}`;
}

export function sessionShareText({
  title,
  date,
  kind,
  matches,
  names,
  champion,
  runnerUp,
  through,
  url,
}: {
  title: string; // "October Singles 2026 – Finals Day"
  date: string | null; // "Saturday 17 October"
  kind: Kind;
  matches: ShareMatch[];
  names: Record<string, string>;
  champion: string | null;
  runnerUp: string | null;
  // A qualifying session: who's through to Finals Day so far
  through: string[];
  url: string;
}): string {
  const lines: string[] = [title];
  if (date) lines.push(date);
  if (champion) lines.push("", `Champion: ${champion}${runnerUp ? ` (runner-up ${runnerUp})` : ""}`);
  if (through.length) lines.push("", `Through to Finals Day: ${through.join(", ")}`);

  const byRound = new Map<number, ShareMatch[]>();
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }
  for (const [round, list] of [...byRound.entries()].sort((x, y) => y[0] - x[0])) {
    const played = list
      .sort((x, y) => x.slot - y.slot)
      .map((m) => matchLine(m, names))
      .filter((l): l is string => Boolean(l));
    if (played.length === 0) continue;
    lines.push("", roundLabel(kind, round, list.length), ...played);
  }
  lines.push("", `Full results: ${url}`);
  return lines.join("\n");
}

// A competition at a glance: its champion once there is one, otherwise
// what's next
export function competitionShareText({
  title,
  runBy,
  champion,
  runnerUp,
  next,
  url,
}: {
  title: string; // "Spring Doubles 2027"
  runBy: string;
  champion: string | null;
  runnerUp: string | null;
  next: string | null; // "One day · Sat 13 Mar · Start 10am"
  url: string;
}): string {
  const lines = [title, runBy];
  if (champion) lines.push("", `Champion: ${champion}${runnerUp ? ` (runner-up ${runnerUp})` : ""}`);
  else if (next) lines.push("", `Next: ${next}`);
  lines.push("", url);
  return lines.join("\n");
}
