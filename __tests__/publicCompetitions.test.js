const {
  shortDate,
  dateRange,
  datesSummary,
  formatLine,
  publicStatus,
  nextSession,
  sortForList,
  filterList,
  daysUntil,
  comingUp,
  rowState,
  sessionLabel,
  latestResults,
  monthGrid,
  coloursFor,
  marksByDay,
  monthFor,
  todayIso,
  PALETTE,
} = require("../lib/publicCompetitions.ts");

const session = (over) => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  competition_id: "c",
  kind: "qualifier",
  session_number: 1,
  date: null,
  start_time: null,
  postponed: false,
  postponed_reason: null,
  original_date: null,
  draw_published: false,
  status: "upcoming",
  liveCount: 0,
  ...over,
});

const comp = (over) => ({
  id: over.id ?? "c",
  year: 2027,
  name: "Floodlit Singles",
  slug: "floodlit-singles",
  label: null,
  format: "qualifying_and_finals",
  team_size: 1,
  draw_size: 16,
  qualifying_nights: 4,
  entries_per_night: 16,
  qualifiers_per_night: 4,
  target_score: 21,
  venue_id: null,
  organiser: { name: "Penwortham Sports & Social Club", short_name: "Penwortham", kind: "club" },
  sponsors: [],
  sessions: [],
  entryCount: 0,
  champion: null,
  ...over,
});

const floodlit = comp({
  id: "floodlit",
  sessions: [
    session({ date: "2027-06-07" }),
    session({ date: "2027-06-08", session_number: 2 }),
    session({ date: "2027-06-09", session_number: 3 }),
    session({ date: "2027-06-10", session_number: 4 }),
    session({ date: "2027-06-12", kind: "finals", session_number: 5 }),
  ],
});
const march = comp({
  id: "march",
  name: "Spring Doubles",
  format: "single_day",
  team_size: 2,
  draw_size: 32,
  qualifying_nights: null,
  sessions: [session({ date: "2027-03-13", kind: "single_day" })],
});
const tbc = comp({ id: "tbc", name: "October Singles", sessions: [session({}), session({ kind: "finals" })] });

describe("dates written out", () => {
  test("short dates and ranges", () => {
    expect(shortDate("2027-06-07")).toBe("Mon 7 Jun");
    expect(dateRange("2027-06-07", "2027-06-10")).toBe("Mon 7 – Thu 10 Jun");
    expect(dateRange("2027-06-28", "2027-07-01")).toBe("Mon 28 Jun – Thu 1 Jul");
    expect(dateRange("2027-06-07", "2027-06-07")).toBe("Mon 7 Jun");
  });

  test("a competition's dates", () => {
    expect(datesSummary(floodlit.sessions)).toBe("Qualifying Mon 7 – Thu 10 Jun · Finals Day Sat 12 Jun");
    expect(datesSummary(march.sessions)).toBe("One day Sat 13 Mar");
    expect(datesSummary(tbc.sessions)).toBe("Dates to be confirmed");
  });

  test("format line", () => {
    expect(formatLine(floodlit)).toBe("Penwortham · Singles · 4 sessions + Finals Day");
    expect(formatLine(march)).toBe("Penwortham · Doubles · 32 pairs, one day");
    expect(formatLine({ ...march, label: "Ladies", organiser: { short_name: "Blackpool", kind: "event" } })).toBe(
      "Event · Doubles · Ladies · 32 pairs, one day"
    );
  });
});

describe("status and order", () => {
  test("live, coming up, planned, finished", () => {
    const live = comp({ sessions: [session({ date: "2027-06-09", status: "live" })] });
    expect(publicStatus(live, "2027-06-09")).toBe("live");
    expect(publicStatus(floodlit, "2027-06-01")).toBe("coming_up");
    expect(publicStatus(tbc, "2027-06-01")).toBe("planned");
    expect(publicStatus({ ...floodlit, champion: { name: "X" } }, "2027-06-13")).toBe("finished");
    expect(publicStatus(floodlit, "2027-07-01")).toBe("finished");
  });

  test("next session skips finished ones", () => {
    const partway = comp({
      sessions: [session({ date: "2027-06-07", status: "complete" }), session({ id: "two", date: "2027-06-08" })],
    });
    expect(nextSession(partway, "2027-06-07").id).toBe("two");
  });

  test("the list's order", () => {
    const today = "2027-03-01";
    const finished = comp({ id: "old", name: "Spring Singles", champion: { name: "X" }, sessions: [session({ date: "2027-02-01", kind: "finals" })] });
    expect(sortForList([finished, tbc, floodlit, march], today).map((c) => c.id)).toEqual(["march", "floodlit", "tbc", "old"]);
  });

  test("filters", () => {
    const today = "2027-03-01";
    expect(filterList([floodlit, march, tbc], "doubles", today).map((c) => c.id)).toEqual(["march"]);
    expect(filterList([floodlit, march, tbc], "coming_up", today).map((c) => c.id)).toEqual(["floodlit", "march"]);
    expect(filterList([comp({ id: "l", label: "Ladies" }), march], "label:Ladies", today).map((c) => c.id)).toEqual(["l"]);
  });
});

describe("the home page lists", () => {
  test("coming up: each competition's next session, soonest first", () => {
    const picks = comingUp([floodlit, march, tbc], "2027-03-09");
    expect(picks.map((p) => `${p.competition.id} ${p.session.date}`)).toEqual(["march 2027-03-13", "floodlit 2027-06-07"]);
    expect(daysUntil("2027-03-09", picks[0].session.date)).toBe(4);
    expect(comingUp([floodlit, march], "2027-03-09", 1)).toHaveLength(1);
  });

  test("latest results: each competition's last finished session, newest first", () => {
    const done = comp({
      id: "done",
      sessions: [
        session({ date: "2027-06-07", status: "complete" }),
        session({ date: "2027-06-08", status: "complete", session_number: 2 }),
        session({ date: "2027-06-12", kind: "finals" }),
      ],
    });
    const spring = { ...march, sessions: [session({ date: "2027-03-13", kind: "single_day", status: "complete" })] };
    const picks = latestResults([done, spring, tbc], "2027-06-10");
    expect(picks.map((p) => `${p.competition.id} ${p.session.date}`)).toEqual(["done 2027-06-08", "march 2027-03-13"]);
  });
});

describe("a competition in a list", () => {
  test("the next session, numbered when there are several", () => {
    const state = rowState(floodlit, "2027-06-08");
    expect(state.kind).toBe("next");
    expect(state.date).toBe("2027-06-08");
    expect(sessionLabel(floodlit, state.session)).toBe("Qualifying session 2 of 4");
    expect(sessionLabel(march, march.sessions[0])).toBe("One day");
  });

  test("on now, won, or dates to come", () => {
    const live = { ...march, sessions: [session({ date: "2027-03-13", kind: "single_day", status: "live" })] };
    expect(rowState(live, "2027-03-13").kind).toBe("live");
    const won = { ...march, champion: { name: "A & B", runnerUp: null, date: "2027-03-13" } };
    expect(rowState(won, "2027-04-01")).toMatchObject({ kind: "won", date: "2027-03-13" });
    expect(rowState(tbc, "2027-04-01")).toEqual({ kind: "tbc", date: null });
  });
});

describe("calendar", () => {
  test("whole Monday-to-Sunday weeks", () => {
    const june = monthGrid(2027, 5);
    expect(june[0][0]).toEqual({ iso: "2027-05-31", day: 31, inMonth: false });
    expect(june[0][1].iso).toBe("2027-06-01");
    expect(june[june.length - 1][6]).toEqual({ iso: "2027-07-04", day: 4, inMonth: false });
    expect(june.every((w) => w.length === 7)).toBe(true);
  });

  test("colours in date order, never gold", () => {
    const days = monthGrid(2027, 5).flat().map((d) => d.iso);
    const later = comp({ id: "later", sessions: [session({ date: "2027-06-28" })] });
    const colours = coloursFor([later, floodlit, march], days);
    expect(colours.get("floodlit")).toBe(PALETTE[0]);
    expect(colours.get("later")).toBe(PALETTE[1]);
    expect(colours.has("march")).toBe(false);
  });

  test("marks: dots for qualifying, rings for trophy days", () => {
    const marks = marksByDay([floodlit]);
    expect(marks.get("2027-06-07")).toEqual([{ competitionId: "floodlit", trophy: false, live: false }]);
    expect(marks.get("2027-06-12")[0].trophy).toBe(true);
  });

  test("opens on this month, or jumps to a highlighted competition's", () => {
    expect(monthFor([], "2027-03-09")).toEqual({ year: 2027, month: 2 });
    expect(monthFor(["2027-06-07", "2027-06-12"], "2027-03-09")).toEqual({ year: 2027, month: 5 });
    expect(monthFor(["2027-03-13"], "2027-03-09")).toEqual({ year: 2027, month: 2 });
  });

  test("today's date", () => {
    expect(todayIso(new Date(2027, 2, 13, 23, 30))).toBe("2027-03-13");
  });
});

const { competitionPath, resolveCompetition, sessionTitle, timeOfDay } = require("../lib/publicCompetitions.ts");

describe("addresses", () => {
  const all = [
    { slug: "october-singles", year: 2026 },
    { slug: "october-singles", year: 2027 },
    { slug: "spring-doubles", year: 2027 },
  ];

  test("the latest year has the short address, earlier years the year on the end", () => {
    expect(competitionPath(all[1], all)).toBe("/october-singles");
    expect(competitionPath(all[0], all)).toBe("/october-singles-2026");
  });

  test("addresses open the right year", () => {
    expect(resolveCompetition(all, "october-singles")).toBe(all[1]);
    expect(resolveCompetition(all, "october-singles-2026")).toBe(all[0]);
    expect(resolveCompetition(all, "october-singles-2019")).toBeNull();
    expect(resolveCompetition(all, "nothing")).toBeNull();
  });

  test("a series whose own name ends in a year still works", () => {
    const odd = [{ slug: "masters-2000", year: 2027 }];
    expect(resolveCompetition(odd, "masters-2000")).toBe(odd[0]);
  });
});

describe("session wording", () => {
  test("titles and times", () => {
    expect(sessionTitle({ kind: "qualifier", session_number: 3 })).toBe("Qualifying session 3");
    expect(sessionTitle({ kind: "finals", session_number: 5 })).toBe("Finals Day");
    expect(timeOfDay("19:00:00")).toBe("7pm");
    expect(timeOfDay("12:30")).toBe("12:30pm");
    expect(timeOfDay("10:00")).toBe("10am");
    expect(timeOfDay(null)).toBeNull();
  });
});

const { sessionTimes } = require("../lib/publicCompetitions.ts");
const { addMinutes } = require("../lib/timeSlots.ts");

describe("practice and start times", () => {
  test("written out", () => {
    expect(sessionTimes({ practice_time: "18:00:00", start_time: "18:30:00" })).toBe("Practice 6pm · Start 6:30pm");
    expect(sessionTimes({ practice_time: null, start_time: "13:00" })).toBe("Start 1pm");
    expect(sessionTimes({ practice_time: "12:30", start_time: null })).toBe("Practice 12:30pm");
    expect(sessionTimes({})).toBeNull();
  });

  test("half an hour before", () => {
    expect(addMinutes("18:30", -30)).toBe("18:00");
    expect(addMinutes("00:15", -30)).toBe("23:45");
  });
});

const { resolveEvent, eventPath, eventDates } = require("../lib/publicCompetitions.ts");

describe("event pages", () => {
  const masters = { id: "bm", name: "Blackpool Masters", short_name: "Blackpool Masters", kind: "event", slug: "blackpool-masters" };
  const e = (id, year, date) => comp({ id, year, organiser: masters, sessions: [session({ date, kind: "single_day" })] });
  const all = [e("c31", 2027, "2027-09-17"), e("inv", 2027, "2027-09-18"), e("old", 2026, "2026-09-19"), floodlit];

  test("the latest year, or the year asked for", () => {
    expect(resolveEvent(all, "blackpool-masters").competitions.map((c) => c.id)).toEqual(["c31", "inv"]);
    expect(resolveEvent(all, "blackpool-masters-2026").competitions.map((c) => c.id)).toEqual(["old"]);
    expect(resolveEvent(all, "blackpool-masters-2019")).toBeNull();
    expect(resolveEvent(all, "floodlit-singles")).toBeNull(); // a club's competition, not an event
  });

  test("its address and dates", () => {
    expect(eventPath("blackpool-masters", 2027, all)).toBe("/blackpool-masters");
    expect(eventPath("blackpool-masters", 2026, all)).toBe("/blackpool-masters-2026");
    expect(eventDates(resolveEvent(all, "blackpool-masters").competitions)).toEqual({ from: "2027-09-17", to: "2027-09-18" });
  });
});
