// Narrowing a session's matches down on a phone: Live, Up next (both players
// known, not started), Finished - and a name typed into Find a match.
import { matchesSearch } from "@/lib/people";

export type MatchFilter = "all" | "live" | "next" | "finished";

export const FILTER_LABEL: Record<MatchFilter, string> = {
  all: "All",
  live: "Live",
  next: "Up next",
  finished: "Finished",
};

type M = { status: string; player_a_id: string | null; player_b_id: string | null };

export function showMatch(m: M, filter: MatchFilter, names: Record<string, string>, query: string): boolean {
  if (filter === "live" && m.status !== "live") return false;
  if (filter === "next" && !(m.status === "upcoming" && m.player_a_id && m.player_b_id)) return false;
  if (filter === "finished" && m.status !== "complete") return false;
  if (query.trim()) {
    const players = [m.player_a_id, m.player_b_id].map((id) => (id ? names[id] ?? "" : ""));
    return players.some((n) => n && matchesSearch(n, query));
  }
  return true;
}

// Where a scorer starts: what's being played, or else what's next
export function startingFilter(matches: M[], scorer: boolean): MatchFilter {
  if (!scorer) return "all";
  if (matches.some((m) => m.status === "live")) return "live";
  if (matches.some((m) => m.status === "upcoming" && m.player_a_id && m.player_b_id)) return "next";
  return "all";
}
