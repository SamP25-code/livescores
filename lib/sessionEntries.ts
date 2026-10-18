// Who's in each session's draw. There's no separate "add to the draw" step:
//   - a single day or a final: everyone entered
//   - a qualifying session: everyone entered for that session
// Until the draw is made, each session's places are kept in step with its
// entries automatically. The database fills each place's name from its entry
// (supabase/migrations/2027_05); a pair comes back as "A & B".

const PAIR_JOIN = " & ";

// "Wayne Ditchfield & Lee Hanson" -> ["Wayne Ditchfield", "Lee Hanson"], so a
// pair can be shown one name per line on a phone. A single name is one line.
export function nameLines(name: string): string[] {
  const parts = name.split(PAIR_JOIN);
  return parts.length === 2 && parts.every((p) => p.trim()) ? parts : [name];
}

type EntryLike = { id: string; status: "entered" | "withdrawn"; session_id?: string | null };
type SessionLike = { id: string; kind: string };

// The entries that make up this session's draw
export function entriesForSession<T extends EntryLike>(entries: T[], session: SessionLike): T[] {
  if (session.kind === "finals") return [];
  return entries.filter(
    (e) => e.status === "entered" && (session.kind !== "qualifier" || e.session_id === session.id)
  );
}

// What has to change for a session's places to match its entries: places to
// add for new entries, and places to remove for entries that have gone
// (withdrawn, moved to another session). Places typed in before 2027 (no
// entry) are left alone.
export function placesToSync(
  entryIds: string[],
  places: { id: string; entry_id?: string | null }[]
): { add: string[]; remove: string[] } {
  const wanted = new Set(entryIds);
  const have = new Set(places.map((p) => p.entry_id).filter(Boolean));
  return {
    add: entryIds.filter((id) => !have.has(id)),
    remove: places.filter((p) => p.entry_id && !wanted.has(p.entry_id)).map((p) => p.id),
  };
}

// The session a new entry goes in by default: the first with space left
// (or the first, if they're all full)
export function defaultSession<S extends { id: string }>(
  sessions: S[],
  entries: EntryLike[],
  perSession: number | null
): S | null {
  if (sessions.length === 0) return null;
  const count = (id: string) => entries.filter((e) => e.status === "entered" && e.session_id === id).length;
  return sessions.find((s) => perSession == null || count(s.id) < perSession) ?? sessions[0];
}
