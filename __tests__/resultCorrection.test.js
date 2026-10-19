const { planCorrection } = require("../lib/resultCorrection.ts");

const finished = { status: "complete", score_a: 21, score_b: 15, target_score: 21, winner_side: "a" };
const names = { a: "Wayne Ditchfield", b: "Lee Hanson" };
const upcoming = { status: "upcoming", score_a: 0, score_b: 0 };

describe("correcting a result", () => {
  test("same winner, different score: just the score changes", () => {
    const plan = planCorrection({ match: finished, scoreA: 21, scoreB: 18, names, nextMatch: upcoming, finalsPlace: null });
    expect(plan).toMatchObject({ winner: "a", winnerChanged: false, next: "none", confirm: null, blocked: null });
  });

  test("new winner, next match not started: they take the place", () => {
    const plan = planCorrection({ match: finished, scoreA: 15, scoreB: 21, names, nextMatch: upcoming, finalsPlace: null });
    expect(plan).toMatchObject({ winner: "b", winnerChanged: true, next: "swap", confirm: null, blocked: null });
  });

  test("next match already started: the admin is asked first", () => {
    const plan = planCorrection({
      match: finished,
      scoreA: 15,
      scoreB: 21,
      names,
      nextMatch: { status: "live", score_a: 4, score_b: 2 },
      finalsPlace: null,
    });
    expect(plan.next).toBe("swap_and_restart");
    expect(plan.confirm).toBe(
      "Wayne Ditchfield has already started their next match (4-2). Changing the result puts Lee Hanson in their place and starts that match again at 0-0."
    );
  });

  test("next match already finished: later results first", () => {
    const plan = planCorrection({
      match: finished,
      scoreA: 15,
      scoreB: 21,
      names,
      nextMatch: { status: "complete", score_a: 21, score_b: 9 },
      finalsPlace: null,
    });
    expect(plan.blocked).toMatch(/already finished their next match/);
  });

  test("a qualifying session's winner: their Finals Day place moves, unless they've played there", () => {
    expect(
      planCorrection({ match: finished, scoreA: 15, scoreB: 21, names, nextMatch: null, finalsPlace: { played: false } }).finals
    ).toBe("move");
    expect(
      planCorrection({ match: finished, scoreA: 15, scoreB: 21, names, nextMatch: null, finalsPlace: { played: true } }).blocked
    ).toMatch(/already played on Finals Day/);
  });

  test("a walkover can be corrected to a real result", () => {
    const walkover = { ...finished, score_a: 0, score_b: 0 };
    expect(planCorrection({ match: walkover, scoreA: 21, scoreB: 7, names, nextMatch: upcoming, finalsPlace: null }).winnerChanged).toBe(false);
  });

  test("needs a winner, and sensible scores", () => {
    expect(() => planCorrection({ match: finished, scoreA: 20, scoreB: 15, names, nextMatch: null, finalsPlace: null })).toThrow(
      /needs a winner/
    );
    expect(() => planCorrection({ match: finished, scoreA: 25, scoreB: 15, names, nextMatch: null, finalsPlace: null })).toThrow(
      /higher than 21/
    );
  });
});
