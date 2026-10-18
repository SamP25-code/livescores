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
