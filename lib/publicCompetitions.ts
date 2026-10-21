// How competitions appear on the public pages: their dates written out,
// whether they're live / coming up / planned / finished, the order of the
// list, the calendar's month grid and colours, and the "Next up" pick.
// All worked out from each competition's sessions - nothing entered twice.

export type PublicSessionKind = "qualifier" | "finals" | "single_day" | "final";

export type PublicSession = {
  id: string;
  competition_id: string;
  kind: PublicSessionKind;
  session_number: number | null;
  date: string | null;
  start_time: string | null;
  practice_time?: string | null;
  postponed: boolean;
  postponed_reason: string | null;
  original_date: string | null;
  draw_published: boolean;
  // From its matches
  status: "upcoming" | "live" | "complete";
  liveCount: number;
  // How many matches it has - none until its draw is made
  matchCount?: number;
};

export type Champion = { name: string; runnerUp: string | null; date: string | null };

export type PublicCompetition = {
  id: string;
  year: number;
  name: string;
  slug: string;
  label: string | null;
  format: "qualifying_and_finals" | "single_day" | "final_only";
  team_size: 1 | 2;
  draw_size: number | null;
  qualifying_nights: number | null;
  entries_per_night: number | null;
  qualifiers_per_night: number | null;
  target_score: 21 | 31;
  venue_id: string | null;
  organiser: { id: string; name: string; short_name: string; kind: "club" | "event"; slug: string | null };
  entry_method: "open" | "qualification" | "on_the_night";
  sponsors: { name: string; url: string | null; logo_url: string | null }[];
  sessions: PublicSession[];
  entryCount: number;
  champion: Champion | null;
};

// A club's own page, listing all its competitions
export function clubPath(organiser: Pick<PublicCompetition["organiser"], "slug">): string | null {
  return organiser.slug ? `/clubs/${organiser.slug}` : null;
}

// Where a competition's club or event pill goes: the club's page, or the event's
export function organiserPath(c: PublicCompetition, all: PublicCompetition[]): string | null {
  if (!c.organiser.slug) return null;
  return c.organiser.kind === "event" ? eventPath(c.organiser.slug, c.year, all) : clubPath(c.organiser);
}

export type PublicStatus = "live" | "coming_up" | "planned" | "finished";

export const STATUS_LABEL: Record<PublicStatus, string> = {
  live: "Live",
  coming_up: "Coming up",
  planned: "Planned",
  finished: "Finished",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Dates are plain "YYYY-MM-DD" strings, worked with in UTC so the clocks
// changing never shifts a day
function parts(iso: string): { y: number; m: number; d: number; dow: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

function isoOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function dayNumber(iso: string): number {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d) / 86400000;
}

export function todayIso(now: Date = new Date()): string {
  // The local date where the phone is (the UK, for everyone using it)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// "2027-06-07" -> "Mon 7 Jun"
export function shortDate(iso: string): string {
  const { m, d, dow } = parts(iso);
  return `${DAYS[dow]} ${d} ${MONTHS[m - 1]}`;
}

// "Mon 7 – Thu 10 Jun", or across months "Mon 28 Jun – Thu 1 Jul"
export function dateRange(from: string, to: string): string {
  if (from === to) return shortDate(from);
  const a = parts(from);
  const b = parts(to);
  if (a.y === b.y && a.m === b.m) return `${DAYS[a.dow]} ${a.d} – ${shortDate(to)}`;
  return `${shortDate(from)} – ${shortDate(to)}`;
}

export function isTrophyDay(kind: PublicSessionKind): boolean {
  return kind !== "qualifier";
}

export const TROPHY_LABEL: Record<Exclude<PublicSessionKind, "qualifier">, string> = {
  finals: "Finals Day",
  single_day: "One day",
  final: "Final",
};

// "Qualifying Mon 7 – Thu 10 Jun · Finals Day Sat 12 Jun"
export function datesSummary(sessions: Pick<PublicSession, "kind" | "date">[]): string {
  const dated = sessions.filter((s) => s.date).sort((a, b) => a.date!.localeCompare(b.date!));
  if (dated.length === 0) return "Dates to be confirmed";
  const out: string[] = [];
  const qualifying = dated.filter((s) => s.kind === "qualifier");
  if (qualifying.length > 0) {
    out.push(`Qualifying ${dateRange(qualifying[0].date!, qualifying[qualifying.length - 1].date!)}`);
  }
  for (const s of dated.filter((x) => isTrophyDay(x.kind))) {
    out.push(`${TROPHY_LABEL[s.kind as keyof typeof TROPHY_LABEL]} ${shortDate(s.date!)}`);
  }
  return out.join(" · ");
}

// "Penwortham · Doubles · 32 pairs, one day"
export function formatLine(c: Pick<PublicCompetition, "organiser" | "team_size" | "label" | "format" | "draw_size" | "qualifying_nights">): string {
  const kind = c.team_size === 2 ? "Doubles" : "Singles";
  const shape =
    c.format === "qualifying_and_finals"
      ? `${c.qualifying_nights ?? "?"} sessions + Finals Day`
      : c.format === "single_day"
        ? `${c.draw_size ?? "?"} ${c.team_size === 2 ? "pairs" : "players"}, one day`
        : "Final";
  return [c.organiser.kind === "event" ? "Event" : c.organiser.short_name, kind, c.label, shape]
    .filter(Boolean)
    .join(" · ");
}

// What it is, without who runs it: "Singles · Ladies · 32 players",
// "Doubles · 5 sessions + Finals Day". A one-day competition's "one day"
// is left to its date ("One day Sat 18 Sep"), so it isn't said twice.
export function whatItIs(c: Pick<PublicCompetition, "team_size" | "label" | "format" | "draw_size" | "qualifying_nights">): string {
  const shape =
    c.format === "qualifying_and_finals"
      ? `${c.qualifying_nights ?? "?"} sessions + Finals Day`
      : c.format === "single_day"
        ? c.draw_size
          ? `${c.draw_size} ${c.team_size === 2 ? "pairs" : "players"}`
          : null
        : "Final";
  return [c.team_size === 2 ? "Doubles" : "Singles", c.label, shape].filter(Boolean).join(" · ");
}

export function publicStatus(c: Pick<PublicCompetition, "sessions" | "champion">, today: string): PublicStatus {
  if (c.sessions.some((s) => s.status === "live")) return "live";
  if (c.champion) return "finished";
  const dated = c.sessions.filter((s) => s.date);
  if (dated.length === 0) return "planned";
  if (dated.some((s) => s.date! >= today && s.status !== "complete")) return "coming_up";
  return "finished";
}

// The next session still to be played, if any
export function nextSession(c: Pick<PublicCompetition, "sessions">, today: string): PublicSession | null {
  return (
    c.sessions
      .filter((s) => s.date && s.date >= today && s.status !== "complete")
      .sort((a, b) => a.date!.localeCompare(b.date!))[0] ?? null
  );
}

// "Qualifying session 1 of 4", so it's clear there are more to come
export function sessionLabel(c: Pick<PublicCompetition, "sessions">, s: Pick<PublicSession, "kind" | "session_number">): string {
  const qualifying = c.sessions.filter((x) => x.kind === "qualifier").length;
  return s.kind === "qualifier" && qualifying > 1 ? `${sessionTitle(s)} of ${qualifying}` : sessionTitle(s);
}

// A competition in a list, the same everywhere: the date to show and what
// to say about it - on now, the next session and its start, who won, or
// dates still to come
export type RowState =
  | { kind: "live"; date: string; session: PublicSession }
  | { kind: "next"; date: string; session: PublicSession }
  | { kind: "won"; date: string | null; champion: Champion }
  | { kind: "played"; date: string; session: PublicSession }
  | { kind: "tbc"; date: null };
export function rowState(c: PublicCompetition, today: string): RowState {
  const live = c.sessions.find((s) => s.status === "live");
  if (live) return { kind: "live", date: live.date ?? today, session: live };
  if (c.champion) {
    const trophy = c.sessions.find((s) => isTrophyDay(s.kind) && s.date);
    return { kind: "won", date: c.champion.date ?? trophy?.date ?? null, champion: c.champion };
  }
  const next = nextSession(c, today);
  if (next) return { kind: "next", date: next.date!, session: next };
  const played = c.sessions
    .filter((s) => s.date && s.status === "complete")
    .sort((a, b) => b.date!.localeCompare(a.date!))[0];
  if (played) return { kind: "played", date: played.date!, session: played };
  const dated = c.sessions.filter((s) => s.date).sort((a, b) => a.date!.localeCompare(b.date!))[0];
  if (dated) return { kind: "next", date: dated.date!, session: dated };
  return { kind: "tbc", date: null };
}

function lastDate(c: Pick<PublicCompetition, "sessions">): string {
  return c.sessions.reduce((latest, s) => (s.date && s.date > latest ? s.date : latest), "");
}

// Live first, then coming up (soonest first), then planned, then finished
// (most recent first)
export function sortForList<C extends PublicCompetition>(list: C[], today: string): C[] {
  const rank: Record<PublicStatus, number> = { live: 0, coming_up: 1, planned: 2, finished: 3 };
  return [...list].sort((a, b) => {
    const sa = publicStatus(a, today);
    const sb = publicStatus(b, today);
    if (sa !== sb) return rank[sa] - rank[sb];
    if (sa === "coming_up") return (nextSession(a, today)?.date ?? "").localeCompare(nextSession(b, today)?.date ?? "");
    if (sa === "finished") return lastDate(b).localeCompare(lastDate(a));
    return a.name.localeCompare(b.name);
  });
}

export type ListFilter = "all" | "live" | "coming_up" | "finished" | "singles" | "doubles" | `label:${string}`;

export function filterList<C extends PublicCompetition>(list: C[], filter: ListFilter, today: string): C[] {
  if (filter === "all") return list;
  if (filter === "singles") return list.filter((c) => c.team_size === 1);
  if (filter === "doubles") return list.filter((c) => c.team_size === 2);
  if (filter.startsWith("label:")) return list.filter((c) => c.label === filter.slice(6));
  return list.filter((c) => publicStatus(c, today) === filter);
}

// Days from today to a date: 0 today, 1 tomorrow
export function daysUntil(today: string, iso: string): number {
  return dayNumber(iso) - dayNumber(today);
}

// The home page's "Coming up": each competition's next session still to
// play, soonest first
export function comingUp<C extends PublicCompetition>(list: C[], today: string, limit = 4): { competition: C; session: PublicSession }[] {
  return list
    .map((c) => ({ competition: c, session: nextSession(c, today) }))
    .filter((x): x is { competition: C; session: PublicSession } => x.session !== null)
    .sort((a, b) => a.session.date!.localeCompare(b.session.date!) || a.competition.name.localeCompare(b.competition.name))
    .slice(0, limit);
}

// The home page's "Latest results": each competition's most recently
// finished session, newest first
export function latestResults<C extends PublicCompetition>(list: C[], today: string, limit = 3): { competition: C; session: PublicSession }[] {
  return list
    .map((c) => ({
      competition: c,
      session:
        c.sessions
          .filter((s) => s.status === "complete" && s.date && s.date <= today)
          .sort((a, b) => b.date!.localeCompare(a.date!))[0] ?? null,
    }))
    .filter((x): x is { competition: C; session: PublicSession } => x.session !== null)
    .sort((a, b) => b.session.date!.localeCompare(a.session.date!) || a.competition.name.localeCompare(b.competition.name))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export type CalendarDay = { iso: string; day: number; inMonth: boolean };

// The month as whole weeks, Monday to Sunday, with the days either side
export function monthGrid(year: number, month: number /* 0-11 */): CalendarDay[][] {
  const first = Date.UTC(year, month, 1);
  const last = Date.UTC(year, month + 1, 0);
  const start = first - ((new Date(first).getUTCDay() + 6) % 7) * 86400000;
  const end = last + ((7 - new Date(last).getUTCDay()) % 7) * 86400000;
  const weeks: CalendarDay[][] = [];
  for (let t = start; t <= end; t += 7 * 86400000) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const time = t + i * 86400000;
        const date = new Date(time);
        return { iso: isoOf(time), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month };
      })
    );
  }
  return weeks;
}

// Competition colours, never gold (gold only ever means a trophy day).
// Checked for colour-blind readers in order; the rows name every competition
// anyway, so beyond these the list carries it.
export const PALETTE = ["#2f7d4a", "#2f63a8", "#c2477f", "#1f7a7a", "#8a5a2b", "#5b6577"];

// Colours for the competitions with a date in view, in date order
export function coloursFor(list: Pick<PublicCompetition, "id" | "sessions">[], days: string[]): Map<string, string> {
  const inView = new Set(days);
  const firsts = list
    .map((c) => ({
      id: c.id,
      first: c.sessions
        .map((s) => s.date)
        .filter((d): d is string => Boolean(d && inView.has(d)))
        .sort()[0],
    }))
    .filter((x) => x.first)
    .sort((a, b) => a.first!.localeCompare(b.first!) || a.id.localeCompare(b.id));
  return new Map(firsts.map((x, i) => [x.id, PALETTE[i % PALETTE.length]]));
}

export type DayMark = { competitionId: string; trophy: boolean; live: boolean };

// What's on each day
export function marksByDay(list: Pick<PublicCompetition, "id" | "sessions">[]): Map<string, DayMark[]> {
  const marks = new Map<string, DayMark[]>();
  for (const c of list) {
    for (const s of c.sessions) {
      if (!s.date) continue;
      if (!marks.has(s.date)) marks.set(s.date, []);
      marks.get(s.date)!.push({ competitionId: c.id, trophy: isTrophyDay(s.kind), live: s.status === "live" });
    }
  }
  return marks;
}

// The month to open the calendar on: this month, unless a highlighted
// competition's dates are all elsewhere - then its first date's month
export function monthFor(dates: string[], today: string): { year: number; month: number } {
  const t = parts(today);
  const sorted = [...dates].sort();
  if (sorted.length === 0) return { year: t.y, month: t.m - 1 };
  const inThisMonth = sorted.some((d) => {
    const p = parts(d);
    return p.y === t.y && p.m === t.m;
  });
  if (inThisMonth) return { year: t.y, month: t.m - 1 };
  const upcoming = sorted.find((d) => d >= today) ?? sorted[0];
  const p = parts(upcoming);
  return { year: p.y, month: p.m - 1 };
}

// ---------------------------------------------------------------------------
// Addresses: /october-singles always opens the latest year;
// /october-singles-2026 opens that year (the archive)
// ---------------------------------------------------------------------------

export function competitionPath(c: Pick<PublicCompetition, "slug" | "year">, all: Pick<PublicCompetition, "slug" | "year">[]): string {
  const latest = Math.max(...all.filter((x) => x.slug === c.slug).map((x) => x.year), c.year);
  return latest === c.year ? `/${c.slug}` : `/${c.slug}-${c.year}`;
}

export function resolveCompetition<C extends Pick<PublicCompetition, "slug" | "year">>(all: C[], address: string): C | null {
  const exact = all.filter((c) => c.slug === address).sort((a, b) => b.year - a.year)[0];
  if (exact) return exact;
  const match = address.match(/^(.+)-(\d{4})$/);
  if (!match) return null;
  return all.find((c) => c.slug === match[1] && c.year === Number(match[2])) ?? null;
}

// "Qualifying session 3", "Finals Day", "One day", "Final"
export function sessionTitle(s: Pick<PublicSession, "kind" | "session_number">): string {
  return s.kind === "qualifier" ? `Qualifying session ${s.session_number ?? ""}`.trim() : TROPHY_LABEL[s.kind];
}

// "7pm", "12:30pm"
export function timeOfDay(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

// "Practice 6pm · Start 6:30pm", or just the start; null if neither is set
export function sessionTimes(s: { practice_time?: string | null; start_time?: string | null }): string | null {
  const practice = timeOfDay(s.practice_time ?? null);
  const start = timeOfDay(s.start_time ?? null);
  if (!practice && !start) return null;
  return [practice && `Practice ${practice}`, start && `Start ${start}`].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// Events (the Blackpool Masters): one page for all their competitions.
// /blackpool-masters is the latest year; /blackpool-masters-2027 that year.
// ---------------------------------------------------------------------------

export type EventRef = { organiser: PublicCompetition["organiser"]; year: number; competitions: PublicCompetition[] };

export function resolveEvent(all: PublicCompetition[], address: string): EventRef | null {
  const events = all.filter((c) => c.organiser.kind === "event" && c.organiser.slug);
  const pick = (slug: string, year?: number) => {
    const mine = events.filter((c) => c.organiser.slug === slug);
    if (mine.length === 0) return null;
    const y = year ?? Math.max(...mine.map((c) => c.year));
    const competitions = mine.filter((c) => c.year === y);
    return competitions.length ? { organiser: competitions[0].organiser, year: y, competitions } : null;
  };
  const exact = pick(address);
  if (exact) return exact;
  const match = address.match(/^(.+)-(\d{4})$/);
  return match ? pick(match[1], Number(match[2])) : null;
}

export function eventPath(organiserSlug: string, year: number, all: PublicCompetition[]): string {
  const years = all.filter((c) => c.organiser.slug === organiserSlug).map((c) => c.year);
  return Math.max(...years, year) === year ? `/${organiserSlug}` : `/${organiserSlug}-${year}`;
}

// The first and last days an event's competitions are played
export function eventDates(competitions: Pick<PublicCompetition, "sessions">[]): { from: string; to: string } | null {
  const dates = competitions.flatMap((c) => c.sessions.map((s) => s.date)).filter((d): d is string => Boolean(d)).sort();
  return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
}
