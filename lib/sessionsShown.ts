// Which sessions the public night tabs and home list show, until the new
// multi-competition home page exists (roadmap step 4).
//
// - A database that hasn't been moved to the 2027 structure (no session
//   belongs to a competition yet) shows every night, exactly as before.
// - On a night page: only that night's own competition.
// - On the home page: the active competition; if none is active, the most
//   recent archived one (its results); failing that, the soonest planned one.

type SessionLike = { id: string; competition_id?: string | null };
type CompetitionLike = { id: string; status: "planned" | "active" | "archived"; year: number };

export function sessionsShown<T extends SessionLike>(
  sessions: T[],
  competitions: CompetitionLike[],
  currentId?: string
): T[] {
  if (!sessions.some((s) => s.competition_id)) return sessions;

  if (currentId) {
    const current = sessions.find((s) => s.id === currentId);
    if (current) return sessions.filter((s) => (s.competition_id ?? null) === (current.competition_id ?? null));
  }

  const pick =
    competitions.find((c) => c.status === "active") ??
    [...competitions].filter((c) => c.status === "archived").sort((a, b) => b.year - a.year)[0] ??
    [...competitions].filter((c) => c.status === "planned").sort((a, b) => a.year - b.year)[0];

  return pick ? sessions.filter((s) => s.competition_id === pick.id) : sessions;
}
