const {
  tapResult,
  resultEntry,
  displayMatch,
  makeOp,
  winnerIdOf,
  isNetworkError,
} = require("../lib/scoreQueue.ts");

const match = (over = {}) => ({
  id: "m1",
  night_id: "n1",
  target_score: 21,
  score_a: 0,
  score_b: 0,
  status: "upcoming",
  player_a_id: "pa",
  player_b_id: "pb",
  winner_id: null,
  ...over,
});

describe("a tap", () => {
  test("starts the match and adds points", () => {
    expect(tapResult(match(), "a", 2)).toEqual({ score_a: 2, score_b: 0, status: "live", winner_side: null });
  });

  test("finishes it on reaching the target, never past it", () => {
    expect(tapResult(match({ score_a: 20, score_b: 18, status: "live" }), "a", 2)).toEqual({
      score_a: 21,
      score_b: 18,
      status: "complete",
      winner_side: "a",
    });
  });

  test("taking a point off a finished match puts it back in play", () => {
    expect(tapResult(match({ score_a: 21, score_b: 18, status: "complete" }), "a", -1)).toEqual({
      score_a: 20,
      score_b: 18,
      status: "live",
      winner_side: null,
    });
  });

  test("no change, nothing to send", () => {
    expect(tapResult(match(), "b", -1)).toBeNull();
    expect(tapResult(match({ score_a: 21 }), "a", 1)).toBeNull();
  });
});

describe("a typed result", () => {
  test("score so far, or finished", () => {
    expect(resultEntry(match(), 10, 10)).toEqual({ score_a: 10, score_b: 10, status: "live", winner_side: null });
    expect(resultEntry(match(), 15, 21)).toEqual({ score_a: 15, score_b: 21, status: "complete", winner_side: "b" });
  });

  test("refuses scores that can't be", () => {
    expect(() => resultEntry(match(), -1, 3)).toThrow(/negative/);
    expect(() => resultEntry(match(), 22, 3)).toThrow(/higher than 21/);
    expect(() => resultEntry(match({ target_score: 21 }), 21, 21)).toThrow(/level/);
  });
});

describe("waiting scores", () => {
  test("chain from each other and show the latest", () => {
    const m = match();
    const first = makeOp(m, "tap", tapResult(m, "a", 1), "op1", "t1");
    const shown = displayMatch(m, [first]);
    expect(shown.score_a).toBe(1);
    expect(shown.status).toBe("live");

    const second = makeOp(shown, "tap", tapResult(shown, "b", 2), "op2", "t2");
    expect(second.prev).toEqual({ score_a: 1, score_b: 0, status: "live" });
    expect(displayMatch(m, [first, second])).toMatchObject({ score_a: 1, score_b: 2 });
  });

  test("other matches are left alone", () => {
    const m = match();
    const op = makeOp(m, "tap", tapResult(m, "a", 1));
    expect(displayMatch(match({ id: "m2" }), [op]).score_a).toBe(0);
  });

  test("the winner is the right player", () => {
    const m = match({ score_a: 20, status: "live" });
    const op = makeOp(m, "tap", tapResult(m, "a", 1));
    expect(winnerIdOf(op)).toBe("pa");
    expect(displayMatch(m, [op]).winner_id).toBe("pa");
  });
});

describe("no signal or a real refusal", () => {
  test("network failures are waited out", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isNetworkError({ message: "Load failed" })).toBe(true);
    expect(isNetworkError(new TypeError("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(isNetworkError({ message: "x", status: 0 })).toBe(true);
  });

  test("a refusal from the server isn't", () => {
    expect(isNetworkError({ message: "new row violates row-level security policy", code: "42501" })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
