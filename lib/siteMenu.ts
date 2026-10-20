// The side menu's search: every competition, club and event that matches
// what's been typed, narrowing as more letters go in. A club or event
// matching brings in all its competitions.
import { matchesSearch } from "@/lib/people";
import { competitionPath, eventPath, type PublicCompetition } from "@/lib/publicCompetitions";

export type MenuItem = {
  kind: "competition" | "event";
  title: string; // "Floodlit Singles", "Blackpool Masters"
  detail: string; // "Penwortham · 2027", "Event · 3 competitions · 2027"
  href: string;
};

// One entry per competition (its latest year), and one per event
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
  return items.sort((a, b) => a.title.localeCompare(b.title));
}

// What matches the search: by the competition's or event's own name, or by
// the club that runs it ("pen" finds all of Penwortham's)
export function searchMenu(items: MenuItem[], query: string): MenuItem[] {
  if (!query.trim()) return [];
  return items.filter((i) => matchesSearch(i.title, query) || matchesSearch(i.detail.split(" · ")[0], query));
}
