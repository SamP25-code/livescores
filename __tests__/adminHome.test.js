const { cardSummary, drawState } = require("../lib/adminHome.ts");

const session = (over) => ({
  id: "s",
  competition_id: "c",
  kind: "single_day",
  session_number: 1,
  date: "2027-03-13",
  start_time: "10:00",
  postponed: false,
  postponed_reason: null,
  original_date: null,
  draw_published: false,
  status: "upcoming",
  liveCount: 0,
  matchCount: 0,
  ...over,
});
const comp = (sessions) => ({
  id: "c",
  format: "single_day",
  draw_size: 32,
  qualifying_nights: null,
  entries_per_night: null,
  entryCount: 28,
  sessions,
  champion: null,
});

describe("admin home cards", () => {
  test("where the draw has got to", () => {
    expect(drawState(session({}))).toBe("not_made");
    expect(drawState(session({ matchCount: 31 }))).toBe("made_hidden");
    expect(drawState(session({ matchCount: 31, draw_published: true }))).toBe("published");
    expect(drawState(session({ kind: "finals", matchCount: 15 }))).toBe("published");
  });

  test("the next session, entries against the draw size", () => {
    const s = cardSummary(comp([session({})]), "2027-03-01");
    expect(s.focus.id).toBe("s");
    expect(s.live).toBe(false);
    expect(s.drawState).toBe("not_made");
    expect([s.entered, s.capacity]).toEqual([28, 32]);
  });

  test("a live session comes first", () => {
    const s = cardSummary(
      comp([session({ id: "next", date: "2027-03-20" }), session({ id: "now", status: "live", matchCount: 31, draw_published: true })]),
      "2027-03-13"
    );
    expect(s.focus.id).toBe("now");
    expect(s.live).toBe(true);
  });

  test("all played: nothing to focus on", () => {
    expect(cardSummary(comp([session({ status: "complete", date: "2027-03-13" })]), "2027-03-20").focus).toBeNull();
  });
});
