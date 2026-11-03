import type { MatchRow, Player } from "./types";
import type { TimeSlot } from "./timeSlots";

// Moving between a competition's session tabs happens on the page itself:
// the address changes in place (no new history entry, so Back still leaves
// the competition) and the session shown is read back off the address.

// "/night/abc" -> "abc"
export function sessionIdFromPath(pathname: string | null): string | null {
  const m = /^\/night\/([^/?#]+)/.exec(pathname ?? "");
  return m ? decodeURIComponent(m[1]) : null;
}

// A plain click switches tab in place; Ctrl/Cmd/Shift/middle-click is left
// to the browser, so a tab can still open in a new tab or window
export function switchesInPlace(e: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented?: boolean;
}): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export type SessionDraw = { players: Record<string, Player>; matches: MatchRow[]; timeSlots: TimeSlot[] };

// A competition's players, matches and start times, loaded together for
// every session, split back out per session (matches in round and slot order)
export function drawsBySession(
  ids: string[],
  players: Player[],
  matches: MatchRow[],
  slots: (TimeSlot & { night_id: string })[]
): Record<string, SessionDraw> {
  const out: Record<string, SessionDraw> = {};
  for (const id of ids) out[id] = { players: {}, matches: [], timeSlots: [] };
  for (const p of players) if (out[p.night_id]) out[p.night_id].players[p.id] = p;
  for (const m of matches) out[m.night_id]?.matches.push(m);
  for (const { night_id, ...s } of slots) out[night_id]?.timeSlots.push(s);
  for (const id of ids) out[id].matches.sort((a, b) => a.round - b.round || a.slot - b.slot);
  return out;
}
