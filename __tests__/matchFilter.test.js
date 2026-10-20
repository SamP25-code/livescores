const { showMatch, startingFilter } = require("../lib/matchFilter.ts");

const names = { a: "Wayne Ditchfield & Lee Hanson", b: "Gary Platt & Alan Hart", c: "Jack Seddon" };
const live = { status: "live", player_a_id: "a", player_b_id: "b" };
const next = { status: "upcoming", player_a_id: "c", player_b_id: "b" };
const waiting = { status: "upcoming", player_a_id: "c", player_b_id: null };
const done = { status: "complete", player_a_id: "a", player_b_id: "c" };

describe("narrowing matches", () => {
  test("by state", () => {
    expect([live, next, waiting, done].filter((m) => showMatch(m, "live", names, "")).length).toBe(1);
    expect([live, next, waiting, done].filter((m) => showMatch(m, "next", names, ""))).toEqual([next]);
    expect([live, next, waiting, done].filter((m) => showMatch(m, "finished", names, ""))).toEqual([done]);
    expect([live, next, waiting, done].filter((m) => showMatch(m, "all", names, "")).length).toBe(4);
  });

  test("by a name, including either half of a pair", () => {
    expect([live, next, done].filter((m) => showMatch(m, "all", names, "hanson"))).toEqual([live, done]);
    expect([live, next, done].filter((m) => showMatch(m, "all", names, "seddon"))).toEqual([next, done]);
  });

  test("scorers start on what's being played, or what's next", () => {
    expect(startingFilter([live, next], true)).toBe("live");
    expect(startingFilter([next, done], true)).toBe("next");
    expect(startingFilter([done], true)).toBe("all");
    expect(startingFilter([live], false)).toBe("all");
  });
});
