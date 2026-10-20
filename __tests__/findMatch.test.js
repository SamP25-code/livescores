const { yourMatch } = require("../lib/findMatch.ts");

const names = { w: "Wayne Ditchfield", g: "Gary Platt", j: "Jack Seddon" };
const round = (m) => `Round ${m.round}`;
const noTime = () => null;
const m = (over) => ({ id: "m", round: 1, slot: 0, status: "upcoming", player_a_id: "w", player_b_id: "g", score_a: 0, score_b: 0, winner_id: null, ...over });

describe("find your match", () => {
  test("playing now", () => {
    expect(yourMatch("w", [m({ status: "live", score_a: 14, score_b: 9 })], names, round, noTime)).toEqual({
      matchId: "m",
      headline: "Live now · 14-9",
      opponent: "Gary Platt",
      round: "Round 1",
    });
  });

  test("next match, with its time", () => {
    expect(yourMatch("g", [m({})], names, round, () => "10:45").headline).toBe("10:45");
    expect(yourMatch("g", [m({})], names, round, noTime).headline).toBe("Up next");
  });

  test("won and waiting for the next round", () => {
    const won = m({ id: "r1", status: "complete", score_a: 21, score_b: 15, winner_id: "w" });
    const r2 = m({ id: "r2", round: 2, player_a_id: "w", player_b_id: null });
    const found = yourMatch("w", [won, r2], names, round, noTime);
    expect(found.matchId).toBe("r2");
    expect(found.headline).toBe("Through - opponent to be decided");
  });

  test("knocked out: the last match played", () => {
    const lost = m({ status: "complete", score_a: 15, score_b: 21, winner_id: "g" });
    expect(yourMatch("w", [lost], names, round, noTime).headline).toBe("Lost 15-21");
  });

  test("walkovers and byes", () => {
    expect(yourMatch("w", [m({ status: "complete", winner_id: "w" })], names, round, noTime).headline).toBe("Through - walkover");
    expect(yourMatch("w", [m({ status: "complete", player_b_id: null, winner_id: "w" })], names, round, noTime).headline).toBe(
      "Through with a bye"
    );
  });

  test("not in this draw", () => {
    expect(yourMatch("j", [m({})], names, round, noTime)).toBeNull();
  });
});
