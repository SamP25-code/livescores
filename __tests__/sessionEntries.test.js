const { nameLines, placedIn, placeProblem } = require("../lib/sessionEntries.ts");

describe("pair names on two lines", () => {
  test("a pair splits, a single name doesn't", () => {
    expect(nameLines("Wayne Ditchfield & Lee Hanson")).toEqual(["Wayne Ditchfield", "Lee Hanson"]);
    expect(nameLines("Wayne Ditchfield")).toEqual(["Wayne Ditchfield"]);
    expect(nameLines("John Smith (Jnr) & Lee Hanson")).toEqual(["John Smith (Jnr)", "Lee Hanson"]);
  });
});

describe("placing entries in sessions", () => {
  const sessions = [
    { id: "q1", kind: "qualifier", session_number: 1 },
    { id: "q2", kind: "qualifier", session_number: 2 },
    { id: "fd", kind: "finals", session_number: 5 },
    { id: "day", kind: "single_day", session_number: 1 },
  ];
  const places = [
    { night_id: "q1", entry_id: "a" },
    { night_id: "fd", entry_id: "a" },
    { night_id: "q2", entry_id: "b" },
    { night_id: "q2", entry_id: null },
    { night_id: "day", entry_id: "c" },
  ];
  const placed = placedIn(places, sessions);

  test("Finals Day doesn't count as a player's session", () => {
    expect(placed.get("a").id).toBe("q1");
    expect(placed.get("b").id).toBe("q2");
    expect(placed.size).toBe(3);
  });

  test("says why an entry can't go in", () => {
    expect(placeProblem("a", "q1", placed, new Set(["a"]))).toBe("Already in this draw");
    expect(placeProblem("a", "q2", placed, new Set())).toBe("Playing qualifying session 1");
    expect(placeProblem("c", "q2", placed, new Set())).toBe("Already in another session");
    expect(placeProblem("d", "q2", placed, new Set())).toBeNull();
  });
});
