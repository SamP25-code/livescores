const { buildPlayerQualifiers } = require("../lib/playerQualifiers.ts");

const ev = (id, extra = {}) => ({
  id,
  name: `Qualifier ${id}`,
  location: "Marton Institute",
  final_date: "2026-09-19",
  results_depth: "semis",
  winner_person_id: null,
  ...extra,
});
const m = (event, stage, slot, a, b, sa, sb) => ({
  qualifier_event_id: event,
  stage,
  slot,
  person_a_id: a,
  person_b_id: b,
  score_a: sa,
  score_b: sb,
});
const names = new Map([
  ["gareth", "Gareth Coates"],
  ["owen", "Owen Jackson"],
  ["wayne", "Wayne Ditchfield"],
]);

describe("a player's qualifier results", () => {
  test("the winner: final first, then the semi-final", () => {
    const [q] = buildPlayerQualifiers({
      personId: "wayne",
      events: [ev("q1")],
      matches: [m("q1", 2, 0, "wayne", "owen", 21, 12), m("q1", 1, 0, "gareth", "wayne", 15, 21), m("q1", 2, 1, "gareth", "x", 21, 3)],
      names,
    });
    expect(q.finish).toBe("Winner");
    expect(q.matches).toEqual([
      { round: "Final", opponent: "Gareth Coates", opponentId: "gareth", mine: 21, theirs: 15, result: "won" },
      { round: "Semi-finals", opponent: "Owen Jackson", opponentId: "owen", mine: 21, theirs: 12, result: "won" },
    ]);
  });

  test("the runner-up, and someone out earlier", () => {
    const matches = [m("q1", 2, 0, "wayne", "owen", 21, 12), m("q1", 1, 0, "gareth", "wayne", 15, 21)];
    const [gareth] = buildPlayerQualifiers({ personId: "gareth", events: [ev("q1")], matches, names });
    expect(gareth.finish).toBe("Runner-up");
    const [owen] = buildPlayerQualifiers({ personId: "owen", events: [ev("q1")], matches, names });
    expect(owen.finish).toBeNull();
    expect(owen.matches[0]).toMatchObject({ round: "Semi-finals", result: "lost", mine: 12, theirs: 21 });
  });

  test("just the winner recorded, and newest first", () => {
    const list = buildPlayerQualifiers({
      personId: "wayne",
      events: [ev("old", { results_depth: "winner", winner_person_id: "wayne", final_date: "2025-09-20" }), ev("new", { results_depth: "winner", winner_person_id: "wayne" })],
      matches: [],
      names,
    });
    expect(list.map((q) => [q.id, q.finish, q.matches.length])).toEqual([
      ["new", "Winner", 0],
      ["old", "Winner", 0],
    ]);
  });
});
