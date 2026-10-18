// The rules behind the Super "set up a competition" screens - kept free of
// the database so they can be tested on their own. See docs/database-design.md.

export type CompetitionFormat = "qualifying_and_finals" | "single_day" | "final_only";
export type SessionKind = "qualifier" | "finals" | "single_day" | "final";

export type StructureSettings = {
  format: CompetitionFormat;
  team_size: 1 | 2;
  target_score: 21 | 31;
  draw_size: number | null;
  qualifying_nights: number | null;
  entries_per_night: number | null;
  qualifiers_per_night: number | null;
};

// Problems with the settings, in plain words, ready to show above the Save
// button. An empty list means they add up.
export function settingsProblems(s: StructureSettings): string[] {
  const problems: string[] = [];
  const whole = (n: number | null, min: number) => n != null && Number.isInteger(n) && n >= min;

  if (s.format === "qualifying_and_finals") {
    if (!whole(s.qualifying_nights, 1)) problems.push("Enter how many qualifying sessions there are.");
    if (!whole(s.entries_per_night, 2)) problems.push("Enter how many play in each qualifying session (at least 2).");
    if (!whole(s.qualifiers_per_night, 1)) problems.push("Enter how many go through from each session.");
    if (!whole(s.draw_size, 2)) problems.push("Enter the size of the Finals Day draw (at least 2).");
    if (problems.length === 0) {
      const through = s.qualifying_nights! * s.qualifiers_per_night!;
      if (s.qualifiers_per_night! >= s.entries_per_night!) {
        problems.push("Fewer have to go through from each session than play in it.");
      }
      if (through > s.draw_size!) {
        problems.push(
          `${s.qualifying_nights} sessions × ${s.qualifiers_per_night} through is ${through}, more than the Finals Day draw of ${s.draw_size}.`
        );
      }
    }
  } else if (s.format === "single_day") {
    if (!whole(s.draw_size, 2)) problems.push("Enter the size of the draw (at least 2).");
  }
  return problems;
}

// What the settings imply for the qualifying side, so the form can say it
// back ("4 sessions × 4 through = 16, filling the Finals Day draw").
export function finalsFill(s: StructureSettings): { through: number; byes: number } | null {
  if (s.format !== "qualifying_and_finals" || settingsProblems(s).length > 0) return null;
  const through = s.qualifying_nights! * s.qualifiers_per_night!;
  return { through, byes: s.draw_size! - through };
}

// The sessions a competition is made of, in order.
export function planSessions(
  format: CompetitionFormat,
  qualifyingNights: number | null
): Array<{ kind: SessionKind; session_number: number }> {
  if (format === "single_day") return [{ kind: "single_day", session_number: 1 }];
  if (format === "final_only") return [{ kind: "final", session_number: 1 }];
  const nights = Math.max(1, qualifyingNights ?? 1);
  return [
    ...Array.from({ length: nights }, (_, i) => ({ kind: "qualifier" as const, session_number: i + 1 })),
    { kind: "finals" as const, session_number: nights + 1 },
  ];
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

// "2026-10-12" -> "Monday 12th October". Read as a calendar date, so it
// never shifts a day for time zones.
export function longDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[weekday]} ${ordinal(d)} ${MONTHS[m - 1]}`;
}

// The name a session shows on its pages - in the same style as the 2026
// nights ("Monday 12th October", "Finals Day - Saturday 17th October"), so
// the existing night pages show new sessions the same way.
export function sessionName(kind: SessionKind, sessionNumber: number, date: string | null): string {
  if (kind === "finals") return date ? `Finals Day - ${longDate(date)}` : "Finals Day";
  if (kind === "final") return date ? `Final - ${longDate(date)}` : "Final";
  if (date) return longDate(date);
  return kind === "qualifier" ? `Qualifying session ${sessionNumber}` : "Competition day";
}

// "October Singles" -> "october-singles", the competition's year-less address.
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A one-line summary for lists: "Singles · 4 sessions of 16 · 4 through · 16 on Finals Day · 21 up"
export function settingsSummary(
  s: StructureSettings & { label?: string | null }
): string {
  const parts: string[] = [s.team_size === 2 ? "Doubles" : "Singles"];
  if (s.label) parts.push(s.label);
  if (s.format === "qualifying_and_finals") {
    if (s.qualifying_nights && s.entries_per_night) {
      parts.push(`${s.qualifying_nights} session${s.qualifying_nights === 1 ? "" : "s"} of ${s.entries_per_night}`);
    }
    if (s.qualifiers_per_night) parts.push(`${s.qualifiers_per_night} through`);
    if (s.draw_size) parts.push(`${s.draw_size} on Finals Day`);
  } else if (s.format === "single_day") {
    if (s.draw_size) parts.push(`${s.draw_size} ${s.team_size === 2 ? "pairs" : "players"}, one day`);
  } else {
    parts.push("final only");
  }
  parts.push(`${s.target_score} up`);
  return parts.join(" · ");
}
