const {
  stagesFor,
  matchesInStage,
  matchWinner,
  eventWinner,
  sourceLabel,
  resultsProblem,
  duplicateOf,
  placeView,
} = require("../lib/qualifying.ts");

const m = (stage, slot, a, b, sa, sb) => ({ stage, slot, person_a_id: a, person_b_id: b, score_a: sa, score_b: sb });

describe("rounds to enter", () => {
  test("by how much is recorded", () => {
    expect(stagesFor("winner")).toEqual([]);
    expect(stagesFor("final")).toEqual([1]);
    expect(stagesFor("semis")).toEqual([2, 1]);
    expect(stagesFor("quarters")).toEqual([3, 2, 1]);
    expect(stagesFor("last16")).toEqual([4, 3, 2, 1]);
    expect([1, 2, 3, 4].map(matchesInStage)).toEqual([1, 2, 4, 8]);
  });
});

describe("who won", () => {
  test("a match", () => {
    expect(matchWinner(m(1, 0, "alan", "colin", 21, 17))).toBe("alan");
    expect(matchWinner(m(1, 0, "alan", "colin", 15, 21))).toBe("colin");
    expect(matchWinner(m(1, 0, "alan", "colin", null, 21))).toBeNull();
    expect(matchWinner(m(1, 0, "alan", null, 21, 0))).toBeNull();
  });

  test("the qualifying competition", () => {
    expect(eventWinner({ results_depth: "final" }, [m(2, 0, "a", "b", 21, 3), m(1, 0, "alan", "colin", 21, 17)])).toBe("alan");
    expect(eventWinner({ results_depth: "winner", winner_person_id: "tim" }, [])).toBe("tim");
    expect(eventWinner({ results_depth: "final" }, [])).toBeNull();
  });
});

describe("wording", () => {
  test("where a place comes from", () => {
    expect(sourceLabel({ name: "Fylde Classic", location: "Kirkham", final_date: "2027-06-05" })).toBe(
      "Winner · Fylde Classic · Kirkham · Sat 5 Jun"
    );
    expect(sourceLabel({ name: " Spring Open ", location: "", final_date: null })).toBe("Winner · Spring Open");
  });

  test("how a place reads", () => {
    expect(placeView({ source: "winner_of", entry_id: "e", flagged: null }).state).toBe("qualified");
    expect(placeView({ source: "winner_of", entry_id: null, flagged: null }).label).toBe("To be decided");
    expect(placeView({ source: "wildcard", entry_id: null, flagged: null }).label).toBe("Chosen nearer the time");
    expect(placeView({ source: "winner_of", entry_id: null, flagged: "Already qualified via place 9" }).state).toBe("flagged");
  });
});

describe("checking results", () => {
  test("just the winner", () => {
    expect(resultsProblem("winner", [], null)).toBe("Choose who won.");
    expect(resultsProblem("winner", [], "tim")).toBeNull();
  });

  test("the final is needed; earlier rounds can be left out", () => {
    expect(resultsProblem("semis", [], null)).toBe("Enter both players in the final.");
    expect(resultsProblem("semis", [m(1, 0, "alan", "colin", 21, 17)], null)).toBeNull();
    expect(resultsProblem("final", [m(1, 0, "alan", "colin", 21, 21)], null)).toBe("Scores can't be level in the final.");
    expect(resultsProblem("final", [m(1, 0, "alan", "alan", 21, 3)], null)).toBe("The same person is on both sides in the final.");
    expect(resultsProblem("semis", [m(2, 1, "a", "b", 21, null), m(1, 0, "alan", "colin", 21, 17)], null)).toBe(
      "Enter both scores in semi-final 2."
    );
  });
});

describe("qualifying twice", () => {
  test("the first place counts; the other is flagged", () => {
    const filled = [{ placeId: "p9", placeNumber: 9, personId: "alan" }];
    expect(duplicateOf("alan", { id: "p3" }, filled)).toBe(9);
    expect(duplicateOf("alan", { id: "p9" }, filled)).toBeNull();
    expect(duplicateOf("tim", { id: "p3" }, filled)).toBeNull();
  });
});
