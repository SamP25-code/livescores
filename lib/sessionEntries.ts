// Putting a competition's entries into its sessions' draws, and showing the
// names that come back. The database fills each place's name from its entry
// (supabase/migrations/2027_05); a pair comes back as "A & B".

const PAIR_JOIN = " & ";

// "Wayne Ditchfield & Lee Hanson" -> ["Wayne Ditchfield", "Lee Hanson"], so a
// pair can be shown one name per line on a phone. A single name is one line.
export function nameLines(name: string): string[] {
  const parts = name.split(PAIR_JOIN);
  return parts.length === 2 && parts.every((p) => p.trim()) ? parts : [name];
}

type Place = { night_id: string; entry_id?: string | null };
type SessionInfo = { id: string; kind: string; session_number?: number | null };

// Which session each entry already has a place in. Finals Day isn't counted -
// qualifiers go through to it as well as playing their own session.
export function placedIn(places: Place[], sessions: SessionInfo[]): Map<string, SessionInfo> {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const placed = new Map<string, SessionInfo>();
  for (const p of places) {
    const session = byId.get(p.night_id);
    if (!p.entry_id || !session || session.kind === "finals") continue;
    placed.set(p.entry_id, session);
  }
  return placed;
}

// Why an entry can't be added to this session, if it can't
export function placeProblem(
  entryId: string,
  sessionId: string,
  placed: Map<string, SessionInfo>,
  inThisSession: Set<string>
): string | null {
  if (inThisSession.has(entryId)) return "Already in this draw";
  const other = placed.get(entryId);
  if (other && other.id !== sessionId) {
    return other.kind === "qualifier" && other.session_number
      ? `Playing qualifying session ${other.session_number}`
      : "Already in another session";
  }
  return null;
}

