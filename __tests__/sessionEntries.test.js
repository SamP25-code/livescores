const { nameLines, entriesForSession, placesToSync, defaultSession } = require("../lib/sessionEntries.ts");

describe("pair names on two lines", () => {
  test("a pair splits, a single name doesn't", () => {
    expect(nameLines("Wayne Ditchfield & Lee Hanson")).toEqual(["Wayne Ditchfield", "Lee Hanson"]);
    expect(nameLines("Wayne Ditchfield")).toEqual(["Wayne Ditchfield"]);
    expect(nameLines("John Smith (Jnr) & Lee Hanson")).toEqual(["John Smith (Jnr)", "Lee Hanson"]);
  });
});

describe("who's in a session's draw", () => {
  const entries = [
    { id: "a", status: "entered", session_id: "q1" },
    { id: "b", status: "entered", session_id: "q2" },
    { id: "c", status: "withdrawn", session_id: "q1" },
    { id: "d", status: "entered", session_id: null },
  ];

  test("a qualifying session: those entered for it", () => {
    expect(entriesForSession(entries, { id: "q1", kind: "qualifier" }).map((e) => e.id)).toEqual(["a"]);
  });

  test("a single day: everyone entered", () => {
    expect(entriesForSession(entries, { id: "day", kind: "single_day" }).map((e) => e.id)).toEqual(["a", "b", "d"]);
  });

  test("Finals Day fills from the qualifying sessions instead", () => {
    expect(entriesForSession(entries, { id: "fd", kind: "finals" })).toEqual([]);
  });
});

describe("keeping places in step with entries", () => {
  test("adds new entries, removes ones that have gone, leaves typed names alone", () => {
    const places = [
      { id: "p1", entry_id: "a" },
      { id: "p2", entry_id: "gone" },
      { id: "p3", entry_id: null },
    ];
    expect(placesToSync(["a", "b"], places)).toEqual({ add: ["b"], remove: ["p2"] });
    expect(placesToSync(["a"], [{ id: "p1", entry_id: "a" }])).toEqual({ add: [], remove: [] });
  });
});

describe("default session for a new entry", () => {
  const sessions = [{ id: "q1" }, { id: "q2" }];
  test("the first with space", () => {
    const full = [
      { id: "a", status: "entered", session_id: "q1" },
      { id: "b", status: "entered", session_id: "q1" },
    ];
    expect(defaultSession(sessions, full, 2).id).toBe("q2");
    expect(defaultSession(sessions, full, 3).id).toBe("q1");
    expect(defaultSession(sessions, [...full, { id: "c", status: "withdrawn", session_id: "q2" }], 2).id).toBe("q2");
  });
  test("all full: the first; none at all: nothing", () => {
    expect(defaultSession(sessions, [{ id: "a", status: "entered", session_id: "q1" }, { id: "b", status: "entered", session_id: "q2" }], 1).id).toBe("q1");
    expect(defaultSession([], [], 2)).toBeNull();
  });
});

describe("a full session or draw", () => {
  const { drawLimit, fullProblem } = require("../lib/sessionEntries.ts");
  const october = { format: "qualifying_and_finals", entries_per_night: 16, draw_size: 16 };
  const doubles = { format: "single_day", entries_per_night: null, draw_size: 32 };

  test("how many each draw holds", () => {
    expect(drawLimit(october, "qualifier")).toBe(16);
    expect(drawLimit(october, "finals")).toBe(16);
    expect(drawLimit(doubles, "single_day")).toBe(32);
    expect(drawLimit({ format: "final_only", entries_per_night: null, draw_size: null }, "final")).toBe(2);
  });

  test("the 17th of 16 is stopped; room left is fine", () => {
    expect(fullProblem({ limit: 16, count: 15, where: "Session 2" })).toBeNull();
    expect(fullProblem({ limit: 16, count: 16, where: "Session 2" })).toBe("Session 2 is full - 16 of 16.");
    expect(fullProblem({ limit: 32, count: 30, adding: 4, where: "The draw" })).toBe("The draw only has room for 2 more (30 of 32).");
    expect(fullProblem({ limit: null, count: 99, where: "The draw" })).toBeNull();
  });
});
