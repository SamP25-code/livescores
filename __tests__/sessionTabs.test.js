const { drawsBySession, sessionIdFromPath, switchesInPlace } = require("../lib/sessionTabs.ts");

describe("session tabs", () => {
  test("reads the session off the address", () => {
    expect(sessionIdFromPath("/night/abc-123")).toBe("abc-123");
    expect(sessionIdFromPath("/night/abc/")).toBe("abc");
    expect(sessionIdFromPath("/october-singles")).toBeNull();
    expect(sessionIdFromPath(null)).toBeNull();
  });

  test("only a plain click switches in place", () => {
    const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(switchesInPlace(click)).toBe(true);
    expect(switchesInPlace({ ...click, ctrlKey: true })).toBe(false);
    expect(switchesInPlace({ ...click, metaKey: true })).toBe(false);
    expect(switchesInPlace({ ...click, shiftKey: true })).toBe(false);
    expect(switchesInPlace({ ...click, button: 1 })).toBe(false);
    expect(switchesInPlace({ ...click, defaultPrevented: true })).toBe(false);
  });

  test("splits a competition's draws back out per session", () => {
    const draws = drawsBySession(
      ["a", "b", "c"],
      [
        { id: "p1", night_id: "a", name: "Ann" },
        { id: "p2", night_id: "b", name: "Bob" },
        { id: "p3", night_id: "z", name: "Not asked for" },
      ],
      [
        { id: "m2", night_id: "a", round: 2, slot: 0 },
        { id: "m1", night_id: "a", round: 1, slot: 1 },
        { id: "m0", night_id: "a", round: 1, slot: 0 },
        { id: "m3", night_id: "b", round: 1, slot: 0 },
      ],
      [{ night_id: "b", from_number: 1, to_number: 8, start_time: "10:00" }]
    );
    expect(Object.keys(draws.a.players)).toEqual(["p1"]);
    expect(draws.a.matches.map((m) => m.id)).toEqual(["m0", "m1", "m2"]);
    expect(draws.b.timeSlots).toEqual([{ from_number: 1, to_number: 8, start_time: "10:00" }]);
    // A session with nothing yet still has an (empty) draw, so it shows "No draw yet" at once
    expect(draws.c).toEqual({ players: {}, matches: [], timeSlots: [] });
    expect(draws.z).toBeUndefined();
  });
});
