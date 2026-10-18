const { sessionsShown } = require("../lib/sessionsShown.ts");

const oct = [
  { id: "m", competition_id: "oct26" },
  { id: "t", competition_id: "oct26" },
  { id: "f", competition_id: "oct26" },
];
const flood = [
  { id: "f1", competition_id: "flood27" },
  { id: "fd", competition_id: "flood27" },
];
const all = [oct[0], flood[0], oct[1], flood[1], oct[2]];
const comps = [
  { id: "oct26", status: "archived", year: 2026 },
  { id: "flood27", status: "planned", year: 2027 },
];

describe("sessionsShown", () => {
  test("a database not yet moved over shows every night, as before", () => {
    const old = [{ id: "a", competition_id: null }, { id: "b" }];
    expect(sessionsShown(old, [], "a")).toBe(old);
  });

  test("a night page shows only its own competition", () => {
    expect(sessionsShown(all, comps, "fd").map((s) => s.id)).toEqual(["f1", "fd"]);
    expect(sessionsShown(all, comps, "t").map((s) => s.id)).toEqual(["m", "t", "f"]);
  });

  test("home shows the active competition first", () => {
    const withActive = [comps[0], { ...comps[1], status: "active" }];
    expect(sessionsShown(all, withActive).map((s) => s.id)).toEqual(["f1", "fd"]);
  });

  test("with none active, home shows the latest finished one", () => {
    expect(sessionsShown(all, comps).map((s) => s.id)).toEqual(["m", "t", "f"]);
  });

  test("with only planned ones, home shows the soonest", () => {
    const planned = [{ id: "flood27", status: "planned", year: 2027 }, { id: "x28", status: "planned", year: 2028 }];
    expect(sessionsShown(flood, planned).map((s) => s.id)).toEqual(["f1", "fd"]);
  });
});
