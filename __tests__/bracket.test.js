const {
  roundName,
  roundLabel,
  isMatchComplete,
  getWinnerSide,
  getWinnerId,
  totalRounds,
  firstRoundPairs,
  buildFinalsSlots,
  roundOneSlotForSeed,
  computeNightStatus,
} = require("../lib/bracket.ts");

describe("roundName", () => {
  it("names the final for 2 players", () => {
    expect(roundName(2)).toBe("Final");
  });

  it("names the semi-final for 4 players", () => {
    expect(roundName(4)).toBe("Semi-Final");
  });

  it("names the quarter-final for 8 players", () => {
    expect(roundName(8)).toBe("Quarter-Final");
  });

  it("falls back to 'Round of N' for larger rounds", () => {
    expect(roundName(16)).toBe("Round of 16");
  });
});

describe("roundLabel", () => {
  it("labels qualifier rounds plainly, regardless of match count", () => {
    expect(roundLabel("qualifier", 1, 8)).toBe("Round 1");
    expect(roundLabel("qualifier", 2, 4)).toBe("Round 2");
  });

  it("uses the descriptive knockout names for finals day", () => {
    expect(roundLabel("finals", 1, 8)).toBe("Round of 16");
    expect(roundLabel("finals", 3, 2)).toBe("Semi-Final");
    expect(roundLabel("finals", 4, 1)).toBe("Final");
  });
});

describe("isMatchComplete", () => {
  it("is false when neither side has reached the target", () => {
    expect(isMatchComplete({ score_a: 10, score_b: 12, target_score: 21 })).toBe(false);
  });

  it("is true when side A reaches the target", () => {
    expect(isMatchComplete({ score_a: 21, score_b: 15, target_score: 21 })).toBe(true);
  });

  it("is true when side B reaches the target", () => {
    expect(isMatchComplete({ score_a: 18, score_b: 21, target_score: 21 })).toBe(true);
  });
});

describe("getWinnerSide", () => {
  it("returns null for an unfinished match", () => {
    expect(getWinnerSide({ score_a: 5, score_b: 5, target_score: 21 })).toBeNull();
  });

  it("returns 'a' when side A wins", () => {
    expect(getWinnerSide({ score_a: 21, score_b: 17, target_score: 21 })).toBe("a");
  });

  it("returns 'b' when side B wins", () => {
    expect(getWinnerSide({ score_a: 19, score_b: 21, target_score: 21 })).toBe("b");
  });
});

describe("getWinnerId", () => {
  const base = {
    id: "m1",
    round: 1,
    slot: 0,
    target_score: 21,
    status: "live",
    winner_id: null,
  };

  it("returns null when the match is not yet complete", () => {
    const match = { ...base, player_a_id: "p1", player_b_id: "p2", score_a: 10, score_b: 8 };
    expect(getWinnerId(match)).toBeNull();
  });

  it("returns player A's id when they reach the target first", () => {
    const match = { ...base, player_a_id: "p1", player_b_id: "p2", score_a: 21, score_b: 14 };
    expect(getWinnerId(match)).toBe("p1");
  });

  it("returns player B's id when they reach the target first", () => {
    const match = { ...base, player_a_id: "p1", player_b_id: "p2", score_a: 16, score_b: 21 };
    expect(getWinnerId(match)).toBe("p2");
  });
});

describe("totalRounds", () => {
  it("computes rounds for a 16-player knockout", () => {
    expect(totalRounds(16)).toBe(4);
  });

  it("computes rounds for a finals day of 16", () => {
    expect(totalRounds(16)).toBe(4);
  });

  it("computes rounds for a 2-player final only", () => {
    expect(totalRounds(2)).toBe(1);
  });
});

describe("firstRoundPairs", () => {
  it("pairs 16 players into 8 matches in order", () => {
    const pairs = firstRoundPairs(16);
    expect(pairs).toHaveLength(8);
    expect(pairs[0]).toEqual([0, 1]);
    expect(pairs[7]).toEqual([14, 15]);
  });

  it("throws for an odd player count", () => {
    expect(() => firstRoundPairs(15)).toThrow("playerCount must be even");
  });
});

describe("buildFinalsSlots", () => {
  it("places each player at their seed position, 1-indexed", () => {
    const players = [
      { id: "a", name: "Alice", seed: 3 },
      { id: "b", name: "Bea", seed: 1 },
    ];
    const slots = buildFinalsSlots(players, 4);
    expect(slots).toEqual([players[1], null, players[0], null]);
  });

  it("leaves unseeded players out entirely", () => {
    const players = [{ id: "a", name: "Alice", seed: null }];
    const slots = buildFinalsSlots(players, 2);
    expect(slots).toEqual([null, null]);
  });

  it("defaults to a 16-slot draw", () => {
    expect(buildFinalsSlots([])).toHaveLength(16);
  });
});

describe("roundOneSlotForSeed", () => {
  it("pairs consecutive draw numbers into the same match, a then b", () => {
    expect(roundOneSlotForSeed(1)).toEqual({ slot: 0, side: "a" });
    expect(roundOneSlotForSeed(2)).toEqual({ slot: 0, side: "b" });
    expect(roundOneSlotForSeed(3)).toEqual({ slot: 1, side: "a" });
    expect(roundOneSlotForSeed(4)).toEqual({ slot: 1, side: "b" });
  });

  it("matches firstRoundPairs' pairing for a full 16-slot draw", () => {
    const pairs = firstRoundPairs(16);
    for (let seed = 1; seed <= 16; seed++) {
      const { slot, side } = roundOneSlotForSeed(seed);
      const expectedIndex = side === "a" ? pairs[slot][0] : pairs[slot][1];
      expect(seed - 1).toBe(expectedIndex);
    }
  });
});

describe("computeNightStatus", () => {
  it("is upcoming before any bracket exists", () => {
    expect(computeNightStatus([])).toBe("upcoming");
  });

  it("is upcoming when the bracket exists but nothing has started", () => {
    const matches = [
      { round: 1, status: "upcoming" },
      { round: 1, status: "upcoming" },
    ];
    expect(computeNightStatus(matches)).toBe("upcoming");
  });

  it("is live once any match has started", () => {
    const matches = [
      { round: 1, status: "live" },
      { round: 1, status: "upcoming" },
    ];
    expect(computeNightStatus(matches)).toBe("live");
  });

  it("is live while the last round isn't fully complete, even if earlier rounds are", () => {
    const matches = [
      { round: 1, status: "complete" },
      { round: 1, status: "complete" },
      { round: 2, status: "complete" },
      { round: 2, status: "upcoming" },
    ];
    expect(computeNightStatus(matches)).toBe("live");
  });

  it("is complete once every match in the last round is complete", () => {
    const matches = [
      { round: 1, status: "complete" },
      { round: 1, status: "complete" },
      { round: 2, status: "complete" },
    ];
    expect(computeNightStatus(matches)).toBe("complete");
  });
});
