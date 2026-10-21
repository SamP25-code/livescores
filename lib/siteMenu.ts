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
export function menuItems(all: PublicCompetition[]): MenuItem[] {
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
  for (const club of clubs(all)) {
    items.push({
      kind: "club",
      title: club.name,
      detail: `Club · ${club.count} competition${club.count === 1 ? "" : "s"}`,
      href: club.href,
    });
  }
  return items.sort((a, b) => a.title.localeCompare(b.title));
}

// The events the menu shows in gold, each with its competitions under it
// (the Blackpool Masters, NL&F County): their latest year, soonest first,
// any without dates yet last
export type MenuEvent = { title: string; dates: string | null; href: string; competitions: { title: string; href: string }[] };
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
      const members = list
        .filter((c) => c.year === year)
        .sort((a, b) => firstDate(a).localeCompare(firstDate(b)) || a.name.localeCompare(b.name));
      const dates = eventDates(members);
      return {
        title: list[0].organiser.name,
        dates: dates ? dateRange(dates.from, dates.to) : null,
        from: dates?.from ?? "9999",
        href: eventPath(list[0].organiser.slug!, year, all),
        competitions: members.map((c) => ({ title: c.name, href: competitionPath(c, all) })),
      };
    })
    .sort((a, b) => a.from.localeCompare(b.from) || a.title.localeCompare(b.title))
    .map(({ from: _from, ...e }) => e);
}

function firstDate(c: PublicCompetition): string {
  return c.sessions.map((s) => s.date).filter((d): d is string => Boolean(d)).sort()[0] ?? "9999";
}

// Every club with a competition on the site, A to Z, with how many
// competitions it runs (each counted once, however many years) and the
// venue its competitions are played at most - for its directions
export type ClubSummary = { id: string; name: string; short_name: string; href: string; count: number; venueId: string | null };
export function clubs(all: PublicCompetition[]): ClubSummary[] {
  const found = new Map<string, { id: string; name: string; short_name: string; href: string; slugs: Set<string>; venues: Map<string, number> }>();
  for (const c of all) {
    const href = c.organiser.kind === "club" ? clubPath(c.organiser) : null;
    if (!href) continue;
    if (!found.has(c.organiser.id)) {
      found.set(c.organiser.id, {
        id: c.organiser.id,
        name: c.organiser.name,
        short_name: c.organiser.short_name,
        href,
        slugs: new Set(),
        venues: new Map(),
      });
    }
    const club = found.get(c.organiser.id)!;
    club.slugs.add(c.slug);
    if (c.venue_id) club.venues.set(c.venue_id, (club.venues.get(c.venue_id) ?? 0) + 1);
  }
  return [...found.values()]
    .map(({ slugs, venues, ...club }) => ({
      ...club,
      count: slugs.size,
      venueId: [...venues.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
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
