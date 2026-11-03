const { pounds, readPrizes, prizeRows } = require("../lib/prizes.ts");

describe("pounds", () => {
  test("whole pounds have no pence", () => {
    expect(pounds(200)).toBe("£200");
  });

  test("pence show both digits", () => {
    expect(pounds(12.5)).toBe("£12.50");
  });

  test("thousands get a comma", () => {
    expect(pounds(1000)).toBe("£1,000");
  });
});

describe("readPrizes", () => {
  test("reads places and amounts in order", () => {
    expect(
      readPrizes([
        { place: "Winner", amount: "200" },
        { place: "Runner-up", amount: "£100" },
        { place: "Semi-finalists (each)", amount: "1,000.50" },
      ])
    ).toEqual({
      prizes: [
        { place: "Winner", amount: 200 },
        { place: "Runner-up", amount: 100 },
        { place: "Semi-finalists (each)", amount: 1000.5 },
      ],
    });
  });

  test("blank rows are dropped, and none at all saves as nothing", () => {
    expect(readPrizes([{ place: " ", amount: "" }])).toEqual({ prizes: null });
    expect(readPrizes([])).toEqual({ prizes: null });
  });

  test("an amount with no place is a problem", () => {
    expect(readPrizes([{ place: "", amount: "50" }])).toEqual({ problem: "Say which place gets 50." });
  });

  test("a place with no amount is a problem", () => {
    expect(readPrizes([{ place: "Winner", amount: "" }])).toEqual({ problem: "Enter the prize money for Winner." });
  });

  test("an amount that isn't pounds is a problem", () => {
    expect("problem" in readPrizes([{ place: "Winner", amount: "two hundred" }])).toBe(true);
    expect("problem" in readPrizes([{ place: "Winner", amount: "-5" }])).toBe(true);
    expect("problem" in readPrizes([{ place: "Winner", amount: "1.234" }])).toBe(true);
  });
});

describe("prizeRows", () => {
  test("saved prizes back into form rows", () => {
    expect(prizeRows([{ place: "Winner", amount: 12.5 }])).toEqual([{ place: "Winner", amount: "12.5" }]);
    expect(prizeRows(null)).toEqual([]);
  });
});
