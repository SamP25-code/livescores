const { finalsNumberOptions } = require("../lib/finalsNumbers.ts");

const byId = (p) => p.id;

describe("finalsNumberOptions", () => {
  test("offers every number, free ones unlabelled", () => {
    const options = finalsNumberOptions([null, null, null], "me", byId);
    expect(options).toEqual([
      { number: 1, takenBy: null },
      { number: 2, takenBy: null },
      { number: 3, takenBy: null },
    ]);
  });

  test("labels numbers someone else has, but not the player's own", () => {
    const slots = [{ id: "me", name: "Billy Speed" }, null, { id: "other", name: "Tim Hodge" }];
    expect(finalsNumberOptions(slots, "me", byId)).toEqual([
      { number: 1, takenBy: null },
      { number: 2, takenBy: null },
      { number: 3, takenBy: "Tim Hodge" },
    ]);
  });

  test("matches occupants through occupantIdentity (a qualifier's finals-day row)", () => {
    const slots = [{ id: "finals-row-1", name: "Billy Speed", qualified_from_player_id: "monday-row-1" }];
    const identity = (p) => p.qualified_from_player_id ?? p.id;
    expect(finalsNumberOptions(slots, "monday-row-1", identity)[0].takenBy).toBeNull();
    expect(finalsNumberOptions(slots, "someone-else", identity)[0].takenBy).toBe("Billy Speed");
  });
});
