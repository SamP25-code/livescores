const { actionLabel, buildOverview } = require("../lib/overview.ts");

const session = (over) => ({
  id: over.id ?? "s",
  competition_id: "c",
  kind: "single_day",
  session_number: null,
  date: null,
  start_time: null,
  postponed: false,
  postponed_reason: null,
  original_date: null,
  draw_published: false,
  status: "upcoming",
  liveCount: 0,
  matchCount: 0,
  ...over,
});
const comp = (over) => ({
  id: "c",
  year: 2027,
  name: "Spring Doubles",
  slug: "spring-doubles",
  label: null,
  format: "single_day",
  team_size: 2,
  draw_size: 32,
  qualifying_nights: null,
  entries_per_night: null,
  qualifiers_per_night: null,
  target_score: 21,
  venue_id: "v",
  organiser: { id: "pen", name: "Penwortham", short_name: "Penwortham", kind: "club", slug: "penwortham" },
  entry_method: "open",
  sponsors: [],
  sessions: [],
  entryCount: 32,
  champion: null,
  ...over,
});

describe("the SuperAdmin overview", () => {
  const today = "2027-03-10";

  test("a competition in three days with no draw, short of entries and no admin", () => {
    const c = comp({ entryCount: 28, sessions: [session({ id: "d", date: "2027-03-13" })] });
    const o = buildOverview([c], new Map(), today);
    expect(o.comingUp.map((x) => x.session.id)).toEqual(["d"]);
    expect(o.attention.map((a) => `${a.urgency} ${a.message}`)).toEqual([
      "now No admin assigned",
      "now 28 of 32 entered",
      "now Draw not made",
    ]);
  });

  test("all set: nothing needs doing", () => {
    const c = comp({ sessions: [session({ id: "d", date: "2027-03-13", matchCount: 16, draw_published: true })] });
    expect(buildOverview([c], new Map([["c", 1]]), today).attention).toEqual([]);
  });

  test("live sessions, and ones with no dates or venue yet", () => {
    const on = comp({ id: "on", sessions: [session({ id: "l", date: "2027-03-10", status: "live", matchCount: 16 })] });
    const tbc = comp({ id: "tbc", name: "Autumn Pairs", venue_id: null, sessions: [session({ id: "t" })] });
    const o = buildOverview([on, tbc], new Map([["on", 1], ["tbc", 1]]), today);
    expect(o.live.map((x) => x.session.id)).toEqual(["l"]);
    expect(o.attention.map((a) => `${a.competition.id} ${a.message}`)).toEqual([
      "tbc Dates to be confirmed",
      "tbc Where it's played isn't set",
    ]);
  });

  test("finished competitions are left out; the log reads in words", () => {
    const done = comp({ champion: { name: "A & B", runnerUp: null, date: "2027-03-01" }, sessions: [session({ date: "2027-03-01", status: "complete" })] });
    expect(buildOverview([done], new Map(), today)).toEqual({ live: [], comingUp: [], attention: [] });
    expect(actionLabel("result_corrected")).toBe("Result corrected");
    expect(actionLabel("something_new")).toBe("Something new");
  });
});
