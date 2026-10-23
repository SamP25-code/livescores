const { buildPlayerRecord } = require("../lib/playerRecord.ts");

const session = (id, kind, date, n = null) => ({
  id,
  competition_id: "",
  kind,
  session_number: n,
  date,
  start_time: null,
  postponed: false,
  postponed_reason: null,
  original_date: null,
  draw_published: true,
  status: "complete",
  liveCount: 0,
});
const comp = (over) => ({
  id: "c",
  year: 2027,
  name: "Spring Doubles",
  slug: "spring-doubles",
  label: null,
  format: "single_day",
  team_size: 2,
  draw_size: 4,
  qualifying_nights: null,
  entries_per_night: null,
  qualifiers_per_night: null,
  target_score: 21,
  venue_id: null,
  organiser: { id: "pen", name: "Penwortham", short_name: "Penwortham", kind: "club", slug: "penwortham" },
  entry_method: "open",
  sponsors: [],
  sessions: [],
  entryCount: 4,
  champion: null,
  ...over,
});
const match = (id, night, round, slot, a, b, sa, sb, status = "complete") => ({
  id,
  night_id: night,
  round,
  slot,
  status,
  winner_id: status === "complete" ? (sa > sb ? a : b) : null,
  player_a_id: a,
  player_b_id: b,
  score_a: sa,
  score_b: sb,
});

describe("a player's page", () => {
  // A four-pair one-day doubles: Wayne & Lee beat C & D, then win the final
  const spring = comp({ id: "spring", sessions: [session("day", "single_day", "2027-03-13")] });
  const entries = [{ id: "e1", competition_id: "spring", person_id: "wayne", partner_id: "lee", status: "entered" }];
  const places = [{ id: "p1", night_id: "day", entry_id: "e1" }];
  const matches = [
    match("m1", "day", 1, 0, "p1", "p2", 21, 15),
    match("m2", "day", 1, 1, "p3", "p4", 21, 9),
    match("m3", "day", 2, 0, "p1", "p3", 21, 20),
  ];
  const names = new Map([
    ["lee", "Lee Hanson"],
    ["p2", "C & D"],
    ["p3", "E & F"],
  ]);

  test("their matches, latest round first, with their partner and the title", () => {
    const peopleOf = new Map([["p3", ["e", "f"]]]);
    const r = buildPlayerRecord({ personId: "wayne", entries, places, matches, names, peopleOf, competitions: [spring], honours: [], today: "2027-04-01" });
    expect(r.competitions).toHaveLength(1);
    // The opponents' people, for links to their own pages
    expect(r.competitions[0].matches[0].opponentIds).toEqual(["e", "f"]);
    const c = r.competitions[0];
    expect(c.partner).toBe("Lee Hanson");
    expect(c.finish).toBe("Winner");
    expect(c.matches.map((m) => `${m.round} v ${m.opponent} ${m.mine}-${m.theirs} ${m.result}`)).toEqual([
      "Final v E & F 21-20 won",
      "Semi-Final v C & D 21-15 won",
    ]);
    expect(r).toMatchObject({ played: 2, won: 2 });
    expect(r.titles).toEqual([{ place: "Winner", name: "Spring Doubles", year: 2027, href: "spring", partner: "Lee Hanson" }]);
  });

  test("the partner sees it from their side too", () => {
    const r = buildPlayerRecord({
      personId: "lee",
      entries,
      places,
      matches,
      names: new Map([...names, ["wayne", "Wayne Ditchfield"]]),
      competitions: [spring],
      honours: [],
      today: "2027-04-01",
    });
    expect(r.competitions[0].partner).toBe("Wayne Ditchfield");
    expect(r.titles[0].place).toBe("Winner");
  });

  test("byes are left out; a walkover isn't counted as played", () => {
    const r = buildPlayerRecord({
      personId: "wayne",
      entries,
      places,
      matches: [
        { ...match("b", "day", 1, 0, "p1", null, 0, 0), winner_id: "p1" },
        { ...match("w", "day", 2, 0, "p1", "p3", 0, 0), winner_id: "p1" },
      ],
      names,
      competitions: [spring],
      honours: [],
      today: "2027-04-01",
    });
    expect(r.competitions[0].matches.map((m) => m.result)).toEqual(["walkover"]);
    expect(r.played).toBe(0);
  });

  test("qualifying rounds are named across the whole competition", () => {
    const october = comp({
      id: "oct",
      name: "October Singles",
      format: "qualifying_and_finals",
      team_size: 1,
      qualifying_nights: 4,
      entries_per_night: 16,
      sessions: [session("q1", "qualifier", "2026-10-12", 1)],
    });
    const r = buildPlayerRecord({
      personId: "wayne",
      entries: [{ id: "e9", competition_id: "oct", person_id: "wayne", partner_id: null, status: "entered" }],
      places: [{ id: "w", night_id: "q1", entry_id: "e9" }],
      matches: [
        ...Array.from({ length: 8 }, (_, i) => match(`r1-${i}`, "q1", 1, i, i === 0 ? "w" : `a${i}`, `b${i}`, 21, 8)),
        match("r2", "q1", 2, 0, "w", "x", 21, 18),
      ],
      names: new Map(),
      competitions: [october],
      honours: [],
      today: "2026-11-01",
    });
    expect(r.competitions[0].matches.map((m) => m.round)).toEqual(["Round of 32", "Round of 64"]);
  });

  test("years added by hand to an honours board", () => {
    const r = buildPlayerRecord({
      personId: "wayne",
      entries: [],
      places: [],
      matches: [],
      names,
      competitions: [],
      honours: [{ year: 2019, seriesName: "October Singles", seriesSlug: "october-singles", place: "Runner-up" }],
      today: "2027-04-01",
    });
    expect(r.titles).toEqual([{ place: "Runner-up", name: "October Singles", year: 2019, href: null, partner: null }]);
  });
});
