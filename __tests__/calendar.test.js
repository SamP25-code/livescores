const { buildIcs, calendarSessions, eventTitle, londonToUtc, londonToday } = require("../lib/calendar.ts");

const session = (over = {}) => ({
  id: "s1",
  competition_id: "c1",
  kind: "qualifier",
  session_number: 1,
  date: "2027-04-23",
  start_time: "18:30",
  practice_time: "18:00",
  postponed: false,
  postponed_reason: null,
  original_date: null,
  draw_published: false,
  status: "upcoming",
  liveCount: 0,
  venue_id: null,
  ...over,
});

const competition = { name: "Floodlit Singles", year: 2027, venue_id: "v1", qualifying_nights: 4 };
const venues = [{ id: "v1", name: "Penwortham Sports & Social Club", address: "Leyland Road", postcode: "PR1 9QE", notes: null, created_at: "" }];
const build = (sessions) =>
  buildIcs({
    competition,
    sessions,
    venues,
    pageUrl: "https://crowngreenlive.co.uk/floodlit-singles",
    host: "crowngreenlive.co.uk",
    now: new Date("2026-11-10T12:00:00Z"),
  });

describe("londonToUtc", () => {
  test("summer time is an hour ahead of UTC", () => {
    expect(londonToUtc("2027-04-23", "18:30").toISOString()).toBe("2027-04-23T17:30:00.000Z");
  });

  test("winter time is UTC", () => {
    expect(londonToUtc("2027-01-09", "10:00").toISOString()).toBe("2027-01-09T10:00:00.000Z");
  });
});

describe("londonToday", () => {
  test("late on a summer night in UTC is already tomorrow in the UK", () => {
    expect(londonToday(new Date("2027-06-07T23:30:00Z"))).toBe("2027-06-08");
  });
});

describe("calendarSessions", () => {
  test("keeps dated sessions from today on", () => {
    const c = {
      sessions: [
        session({ id: "past", date: "2026-10-12" }),
        session({ id: "today", date: "2026-11-10" }),
        session({ id: "tbc", date: null }),
        session({ id: "later", date: "2027-04-23" }),
      ],
    };
    expect(calendarSessions(c, "2026-11-10").map((s) => s.id)).toEqual(["today", "later"]);
  });
});

describe("eventTitle", () => {
  test("a qualifying session says which of how many", () => {
    expect(eventTitle(competition, session())).toBe("Floodlit Singles 2027 · Session 1 of 4");
  });

  test("a one-day competition is just its name", () => {
    expect(eventTitle(competition, session({ kind: "single_day" }))).toBe("Floodlit Singles 2027");
  });
});

describe("buildIcs", () => {
  test("a session with a start time runs from the start in UTC", () => {
    const ics = build([session()]);
    expect(ics).toContain("UID:s1@crowngreenlive.co.uk");
    expect(ics).toContain("DTSTART:20270423T173000Z");
    expect(ics).toContain("DTEND:20270423T203000Z");
    expect(ics).toContain("LOCATION:Penwortham Sports & Social Club\\, Leyland Road\\, PR1 9QE");
    expect(ics).toContain("Practice 6pm · Start 6:30pm");
  });

  test("no time makes an all-day entry", () => {
    const ics = build([session({ start_time: null, practice_time: null })]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270423");
    expect(ics).toContain("DTEND;VALUE=DATE:20270424");
  });

  test("lines use CRLF and none is longer than 75 bytes", () => {
    const ics = build([session(), session({ id: "s2", kind: "finals", session_number: null })]);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});
