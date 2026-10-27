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

// How many a draw holds: a qualifying session its "per session" number, a
// one-day draw (or Finals Day) its draw size, a final two. null: no limit set.
export function drawLimit(
  c: { format: string; entries_per_night: number | null; draw_size: number | null },
  kind: string
): number | null {
  if (kind === "qualifier") return c.entries_per_night;
  if (kind === "final" || c.format === "final_only") return 2;
  return c.draw_size;
}

// Why these can't go in: the session (or the draw) is already full. Adding
// one more than it holds would leave 17 in a session of 16.
export function fullProblem({
  limit,
  count,
  adding = 1,
  where,
}: {
  limit: number | null;
  count: number;
  adding?: number;
  where: string; // "Session 2", "The draw"
}): string | null {
  if (!limit || count + adding <= limit) return null;
  if (count >= limit) return `${where} is full - ${count} of ${limit}.`;
  return `${where} only has room for ${limit - count} more (${count} of ${limit}).`;
}
