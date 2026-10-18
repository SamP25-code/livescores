// Rules for people and entries that don't need the database: tidying typed
// names, matching the search, telling same-named people apart, and naming a
// pair. The database calls live in lib/peopleApi.ts.

export type PersonDetails = {
  id: string;
  full_name: string;
  note: string | null;
  club_id: string | null;
  club_name: string | null;
  last_played: string | null; // ISO date of their latest session, if any
};

// " wayne   ditchfield " -> "wayne ditchfield" (for comparing names)
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Collapses spaces, and capitalises a name typed all in lower or upper case:
// "wayne ditchfield" / "WAYNE DITCHFIELD" -> "Wayne Ditchfield",
// "o'brien-smith" -> "O'Brien-Smith". A name typed in mixed case ("McDonald",
// "de Souza") is left exactly as typed.
export function tidyName(name: string): string {
  const spaced = name.trim().replace(/\s+/g, " ");
  if (spaced !== spaced.toLowerCase() && spaced !== spaced.toUpperCase()) return spaced;
  return spaced.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}

function nameWords(name: string): string[] {
  return normaliseName(name)
    .split(/[\s'.-]+/)
    .filter(Boolean);
}

// Every word typed must start one of the name's words, in any order:
// "ditch" finds Wayne Ditchfield, and so do "w ditch" and "ditchfield wayne".
export function matchesSearch(fullName: string, query: string): boolean {
  const typed = nameWords(query);
  if (typed.length === 0) return false;
  const words = nameWords(fullName);
  return typed.every((t) => words.some((w) => w.startsWith(t)));
}

// Search results: the exact name first, then names starting with what was
// typed, then everything else that matches - each group A to Z, and the most
// recent player first among people with the same name.
export function rankMatches<T extends { full_name: string; last_played?: string | null }>(
  people: T[],
  query: string
): T[] {
  const q = normaliseName(query);
  const group = (p: T) => {
    const n = normaliseName(p.full_name);
    return n === q ? 0 : n.startsWith(q) ? 1 : 2;
  };
  return people
    .filter((p) => matchesSearch(p.full_name, query))
    .sort(
      (a, b) =>
        group(a) - group(b) ||
        normaliseName(a.full_name).localeCompare(normaliseName(b.full_name)) ||
        (b.last_played ?? "").localeCompare(a.last_played ?? "")
    );
}

// People already in the app with exactly this name - the "same person?" check
export function sameNamePeople<T extends { full_name: string }>(people: T[], typed: string): T[] {
  const n = normaliseName(typed);
  return people.filter((p) => normaliseName(p.full_name) === n);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-17" -> "Oct 2026"
export function monthYear(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// The line under a name in the search: "Penwortham · Snr · last played Oct 2026"
export function personDetailsLine(p: Pick<PersonDetails, "note" | "club_name" | "last_played">): string {
  return [p.club_name, p.note, p.last_played ? `last played ${monthYear(p.last_played)}` : "not played yet"]
    .filter(Boolean)
    .join(" · ");
}

// A different person with a name that's already taken needs their club or a
// short note, so the two can be told apart from then on.
export function newPersonProblem(
  fullName: string,
  clubId: string | null,
  note: string | null,
  sameName: { note: string | null; club_id: string | null }[]
): string | null {
  if (!tidyName(fullName)) return "Enter their full name.";
  if (sameName.length === 0) return null;
  const tidyNote = note?.trim() || null;
  if (!clubId && !tidyNote) {
    return "There's already someone with this name - add their club or a short note (e.g. Snr, Jnr, a middle initial).";
  }
  const clash = sameName.some(
    (p) => p.club_id === clubId && normaliseName(p.note ?? "") === normaliseName(tidyNote ?? "")
  );
  if (clash) return "That club and note match the existing person - add a note to tell them apart.";
  return null;
}

// Names as shown on a page: just "John Smith", unless two different people
// called John Smith are on the same page - then each gets their club or note.
export function distinguishedNames(
  people: Pick<PersonDetails, "id" | "full_name" | "note" | "club_name">[]
): Map<string, string> {
  const byName = new Map<string, Set<string>>();
  for (const p of people) {
    const key = normaliseName(p.full_name);
    if (!byName.has(key)) byName.set(key, new Set());
    byName.get(key)!.add(p.id);
  }
  const shown = new Map<string, string>();
  for (const p of people) {
    const shared = byName.get(normaliseName(p.full_name))!.size > 1;
    const detail = p.note || p.club_name;
    shown.set(p.id, shared && detail ? `${p.full_name} (${detail})` : p.full_name);
  }
  return shown;
}

// "Wayne Ditchfield" or, for a pair, "Wayne Ditchfield & Lee Hanson"
export function entryName(person: string, partner?: string | null): string {
  return partner ? `${person} & ${partner}` : person;
}

// Checks an entry before it's saved. The database checks the same things;
// this just gives a clearer message first.
export function entryProblem(teamSize: 1 | 2, personId: string | null, partnerId: string | null): string | null {
  if (!personId) return teamSize === 2 ? "Choose both players in the pair." : "Choose the player.";
  if (teamSize === 2 && !partnerId) return "Choose both players in the pair.";
  if (teamSize === 2 && personId === partnerId) return "Choose two different people for the pair.";
  return null;
}

// How many entries the competition holds, if it's fixed: 32 pairs on the day,
// or 4 sessions x 16 for the October Singles.
export function entryCapacity(c: {
  format: "qualifying_and_finals" | "single_day" | "final_only";
  draw_size: number | null;
  qualifying_nights: number | null;
  entries_per_night: number | null;
}): number | null {
  if (c.format === "single_day") return c.draw_size;
  if (c.format === "final_only") return 2;
  if (c.qualifying_nights && c.entries_per_night) return c.qualifying_nights * c.entries_per_night;
  return null;
}
