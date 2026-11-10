// "Add to calendar": a competition's sessions as an .ics file, which any
// phone or computer calendar opens (iPhone, Android / Google, Outlook).
// Each session keeps the same id in the file, so adding it again after a
// postponement moves the entry rather than adding a second one.

import type { PublicCompetition, PublicSession } from "./publicCompetitions";
import { sessionTimes, sessionTitle } from "./publicCompetitions";
import type { Venue } from "./types";

// How long an entry lasts in the calendar, since sessions have a start but
// no set finish: an evening qualifying session or a final, or a whole day
const HOURS: Record<PublicSession["kind"], number> = {
  qualifier: 3,
  final: 3,
  finals: 6,
  single_day: 6,
};

// The sessions worth adding: dated, and today or later
export function calendarSessions(c: Pick<PublicCompetition, "sessions">, today: string): PublicSession[] {
  return c.sessions.filter((s) => s.date && s.date >= today && s.status !== "complete");
}

// The UK date today, wherever the server is
export function londonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}

// A UK clock time on a UK date, as the moment it happens (BST or GMT)
export function londonToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  // What a London clock reads at that UTC moment: the difference is the offset
  const shown = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(asUtc));
  const part = (t: string) => Number(shown.find((p) => p.type === t)?.value);
  const londonAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  return new Date(asUtc - (londonAsUtc - asUtc));
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function dayStamp(iso: string): string {
  return iso.replace(/-/g, "");
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
}

// Commas, semicolons, backslashes and new lines are escaped in text
function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 bytes carry on onto the next, indented by a space
function utf8Length(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
}

function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74;
    if (size + utf8Length(ch) > limit) {
      out.push(current);
      current = ch;
      size = utf8Length(ch);
    } else {
      current += ch;
      size += utf8Length(ch);
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

export type CalendarInput = {
  competition: Pick<PublicCompetition, "name" | "year" | "venue_id" | "qualifying_nights">;
  sessions: PublicSession[];
  venues: Venue[];
  // The competition's page, in full ("https://crowngreenlive.co.uk/floodlit-singles")
  pageUrl: string;
  host: string;
  now?: Date;
};

// "Floodlit Singles 2027 · Session 1 of 4", or just the name for a one-day one
export function eventTitle(competition: CalendarInput["competition"], s: PublicSession): string {
  const name = `${competition.name} ${competition.year}`;
  if (s.kind === "single_day") return name;
  const qualifying = competition.qualifying_nights ?? 0;
  const title = s.kind === "qualifier" && qualifying > 1 ? `${sessionTitle(s)} of ${qualifying}` : sessionTitle(s);
  return `${name} · ${title}`;
}

export function buildIcs({ competition, sessions, venues, pageUrl, host, now = new Date() }: CalendarInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Crown Green Live//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const s of sessions) {
    if (!s.date) continue;
    const venue = venues.find((v) => v.id === (s.venue_id ?? competition.venue_id));
    const time = s.start_time ?? s.practice_time ?? null;
    lines.push("BEGIN:VEVENT", `UID:${s.id}@${host}`, `DTSTAMP:${stamp(now)}`);
    if (time) {
      const start = londonToUtc(s.date, time);
      const end = new Date(start.getTime() + HOURS[s.kind] * 3_600_000);
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dayStamp(s.date)}`, `DTEND;VALUE=DATE:${nextDay(s.date)}`);
    }
    lines.push(`SUMMARY:${text(eventTitle(competition, s))}`);
    if (venue) {
      lines.push(`LOCATION:${text([venue.name, venue.address, venue.postcode].filter(Boolean).join(", "))}`);
    }
    const description = [sessionTimes(s), s.postponed && s.postponed_reason ? s.postponed_reason : null, `Draw and live scores: ${pageUrl}`]
      .filter(Boolean)
      .join("\n");
    lines.push(`DESCRIPTION:${text(description)}`, `URL:${pageUrl}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
