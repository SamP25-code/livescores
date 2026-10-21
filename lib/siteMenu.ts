// The side menu's search: every competition, club and event that matches
// what's been typed, narrowing as more letters go in. A club or event
// matching brings in all its competitions.
import { matchesSearch } from "@/lib/people";
import { clubPath, competitionPath, dateRange, eventDates, eventPath, type PublicCompetition } from "@/lib/publicCompetitions";

export type MenuItem = {
  kind: "competition" | "event" | "club";
  title: string; // "Floodlit Singles", "Blackpool Masters"
  detail: string; // "Penwortham · 2027", "Event · 3 competitions · 2027", "Club · 2 competitions"
  href: string;
};

// One entry per competition (its latest year), one per event and one per club
export function menuItems(all: PublicCompetition[], organisers: ClubOrganiser[] = []): MenuItem[] {
  const items: MenuItem[] = [];
  const latestBySlug = new Map<string, PublicCompetition>();
  for (const c of all) {
    if (c.organiser.kind === "event") continue;
    const seen = latestBySlug.get(c.slug);
    if (!seen || c.year > seen.year) latestBySlug.set(c.slug, c);
  }
  for (const c of latestBySlug.values()) {
    items.push({ kind: "competition", title: c.name, detail: `${c.organiser.short_name} · ${c.year}`, href: competitionPath(c, all) });
  }
  const events = new Map<string, PublicCompetition[]>();
  for (const c of all) {
    if (c.organiser.kind !== "event" || !c.organiser.slug) continue;
    if (!events.has(c.organiser.id)) events.set(c.organiser.id, []);
    events.get(c.organiser.id)!.push(c);
  }
  for (const list of events.values()) {
    const year = Math.max(...list.map((c) => c.year));
    const thisYear = list.filter((c) => c.year === year);
    items.push({
      kind: "event",
      title: list[0].organiser.name,
      detail: `Event · ${thisYear.length} competition${thisYear.length === 1 ? "" : "s"} · ${year}`,
      href: eventPath(list[0].organiser.slug!, year, all),
    });
  }
  for (const club of clubs(all, organisers)) {
    items.push({
      kind: "club",
      title: club.name,
      detail: `Club · ${club.count} competition${club.count === 1 ? "" : "s"}`,
      href: club.href,
    });
  }
  return items.sort((a, b) => a.title.localeCompare(b.title));
}

// The events the menu shows in gold (the Blackpool Masters, NL&F County):
// their latest year, soonest first, any without dates yet last
export type MenuEvent = { title: string; dates: string | null; href: string };
export function menuEvents(all: PublicCompetition[]): MenuEvent[] {
  const byOrganiser = new Map<string, PublicCompetition[]>();
  for (const c of all) {
    if (c.organiser.kind !== "event" || !c.organiser.slug) continue;
    if (!byOrganiser.has(c.organiser.id)) byOrganiser.set(c.organiser.id, []);
    byOrganiser.get(c.organiser.id)!.push(c);
  }
  return [...byOrganiser.values()]
    .map((list) => {
      const year = Math.max(...list.map((c) => c.year));
      const dates = eventDates(list.filter((c) => c.year === year));
      return {
        title: list[0].organiser.name,
        dates: dates ? dateRange(dates.from, dates.to) : null,
        from: dates?.from ?? "9999",
        href: eventPath(list[0].organiser.slug!, year, all),
      };
    })
    .sort((a, b) => a.from.localeCompare(b.from) || a.title.localeCompare(b.title))
    .map(({ from: _from, ...e }) => e);
}

// A club as loaded for the Clubs page: every club, including a venue
// ticked "also a club" that doesn't run a competition of its own yet
export type ClubOrganiser = { id: string; name: string; short_name: string; slug: string | null; venue_id: string | null };

// Whether a competition shows on a club's page: one it runs, or one played
// on its green (the Masters at Marton Institute)
export function playedByOrAt(club: { id: string; venueId: string | null }, c: PublicCompetition): boolean {
  if (c.organiser.id === club.id) return true;
  if (!club.venueId) return false;
  return c.venue_id === club.venueId || c.sessions.some((s) => s.venue_id === club.venueId);
}

// Every club, A to Z, with how many competitions it runs or hosts (each
// counted once, however many years) and its green - its own venue, or the
// one its competitions are played at most - for its directions
export type ClubSummary = { id: string; name: string; short_name: string; href: string; count: number; venueId: string | null };
export function clubs(all: PublicCompetition[], organisers: ClubOrganiser[] = []): ClubSummary[] {
  const found = new Map<string, { id: string; name: string; short_name: string; href: string; venueId: string | null }>();
  for (const o of organisers) {
    const href = clubPath(o);
    if (href) found.set(o.id, { id: o.id, name: o.name, short_name: o.short_name, href, venueId: o.venue_id });
  }
  for (const c of all) {
    const href = c.organiser.kind === "club" ? clubPath(c.organiser) : null;
    if (!href || found.has(c.organiser.id)) continue;
    found.set(c.organiser.id, { id: c.organiser.id, name: c.organiser.name, short_name: c.organiser.short_name, href, venueId: null });
  }
  return [...found.values()]
    .map((club) => {
      // No green of its own: where its competitions are played most
      let venueId = club.venueId;
      if (!venueId) {
        const used = new Map<string, number>();
        for (const c of all) if (c.organiser.id === club.id && c.venue_id) used.set(c.venue_id, (used.get(c.venue_id) ?? 0) + 1);
        venueId = [...used.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }
      const slugs = new Set(all.filter((c) => playedByOrAt({ id: club.id, venueId: club.venueId }, c)).map((c) => c.slug));
      return { ...club, count: slugs.size, venueId };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// What matches the search: by the competition's or event's own name, or by
// the club that runs it ("pen" finds all of Penwortham's)
export function searchMenu(items: MenuItem[], query: string): MenuItem[] {
  if (!query.trim()) return [];
  return items.filter(
    (i) => matchesSearch(i.title, query) || (i.kind === "competition" && matchesSearch(i.detail.split(" · ")[0], query))
  );
}
