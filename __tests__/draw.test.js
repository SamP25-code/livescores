const {
  drawSizeFor,
  shuffle,
  randomDrawNumbers,
  drawNumberProblems,
  slotsByNumber,
  drawnByNumber,
} = require("../lib/draw.ts");
const {
  slotForNumber,
  roundOneTime,
  addMinutes,
  evenSlots,
  timeSlotProblems,
} = require("../lib/timeSlots.ts");

// A repeatable "random" sequence for tests
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const ids = (n) => Array.from({ length: n }, (_, i) => `e${i + 1}`);

describe("draw size", () => {
  test("next power of two", () => {
    expect(drawSizeFor(32)).toBe(32);
    expect(drawSizeFor(30)).toBe(32);
    expect(drawSizeFor(17)).toBe(32);
    expect(drawSizeFor(4)).toBe(4);
    expect(drawSizeFor(1)).toBe(2);
  });
});

describe("random draw", () => {
  test("shuffle keeps everyone", () => {
    expect(shuffle(ids(10), seeded(1)).sort()).toEqual(ids(10).sort());
  });

  test("32 pairs fill numbers 1-32 exactly once", () => {
    const numbers = randomDrawNumbers(ids(32), seeded(7));
    expect([...numbers.values()].sort((a, b) => a - b)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  test("byes never meet each other, whatever the luck", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const count of [17, 20, 27, 30, 31]) {
        const numbers = [...randomDrawNumbers(ids(count), seeded(seed)).values()];
        expect(numbers).toHaveLength(count);
        expect(drawNumberProblems(numbers)).toEqual([]);
      }
    }
  });

  test("different luck gives a different draw", () => {
    const a = [...randomDrawNumbers(ids(32), seeded(1)).entries()];
    const b = [...randomDrawNumbers(ids(32), seeded(2)).entries()];
    expect(a).not.toEqual(b);
  });
});

describe("recording a physical draw", () => {
  test("a complete draw has no problems", () => {
    expect(drawNumberProblems([1, 2, 3, 4])).toEqual([]);
    expect(drawNumberProblems([1, 3, 4])).toEqual([]); // 2 is a bye
  });

  test("catches missing, repeated, out-of-range numbers and two byes together", () => {
    expect(drawNumberProblems([1, null, 3])).toEqual(["1 still to be given a number."]);
    expect(drawNumberProblems([1, 1, 3, 4])).toEqual(["Number 1 is given out twice."]);
    expect(drawNumberProblems([1, 2, 3, 9])).toEqual(["Number 9 is outside the draw of 4."]);
    expect(drawNumberProblems([1, 2, 5, 6, 7])).toEqual([
      "Nobody has 3 or 4, so that match would be two byes.",
    ]);
  });
});

describe("bracket places by number", () => {
  test("empty numbers are byes", () => {
    const players = [
      { id: "a", seed: 3 },
      { id: "b", seed: 1 },
      { id: "c", seed: 4 },
    ];
    expect(slotsByNumber(players).map((p) => p && p.id)).toEqual(["b", null, "a", "c"]);
    expect(drawnByNumber(players)).toBe(true);
    expect(drawnByNumber([{ seed: 1 }, { seed: null }])).toBe(false);
    expect(drawnByNumber([])).toBe(false);
  });

  test("a place marked as a bye is left empty", () => {
    const players = [
      { id: "a", seed: 1 },
      { id: "b", seed: 2, is_bye: true },
    ];
    expect(slotsByNumber(players).map((p) => p && p.id)).toEqual(["a", null]);
  });
});

describe("time slots", () => {
  const slots = [
    { from_number: 1, to_number: 8, start_time: "10:00:00" },
    { from_number: 9, to_number: 16, start_time: "10:45:00" },
    { from_number: 11, to_number: 12, start_time: "11:30:00" }, // one match moved by hand
  ];

  test("the narrowest slot wins", () => {
    expect(slotForNumber(slots, 3).start_time).toBe("10:00:00");
    expect(slotForNumber(slots, 9).start_time).toBe("10:45:00");
    expect(slotForNumber(slots, 11).start_time).toBe("11:30:00");
    expect(slotForNumber(slots, 20)).toBeNull();
  });

  test("first-round match times", () => {
    expect(roundOneTime(slots, 0)).toBe("10:00"); // 1 v 2
    expect(roundOneTime(slots, 4)).toBe("10:45"); // 9 v 10
    expect(roundOneTime(slots, 5)).toBe("11:30"); // 11 v 12
    expect(roundOneTime(slots, 9)).toBeNull(); // 19 v 20
    expect(roundOneTime([], 0)).toBeNull();
  });

  test("quick fill", () => {
    expect(addMinutes("10:00", 45)).toBe("10:45");
    expect(addMinutes("11:30:00", 45)).toBe("12:15");
    expect(evenSlots(32, 8, "10:00", 45)).toEqual([
      { from_number: 1, to_number: 8, start_time: "10:00" },
      { from_number: 9, to_number: 16, start_time: "10:45" },
      { from_number: 17, to_number: 24, start_time: "11:30" },
      { from_number: 25, to_number: 32, start_time: "12:15" },
    ]);
    // An odd group size is rounded down to whole matches
    expect(evenSlots(8, 5, "19:00", 30).map((s) => `${s.from_number}-${s.to_number}`)).toEqual(["1-4", "5-8"]);
  });

  test("problems", () => {
    expect(timeSlotProblems(evenSlots(32, 8, "10:00", 45), 32)).toEqual([]);
    expect(timeSlotProblems([{ from_number: 9, to_number: 40, start_time: "10:00" }], 32)).toEqual([
      "9-40 goes past 32, the size of the draw.",
    ]);
    expect(timeSlotProblems([{ from_number: 5, to_number: 2, start_time: "" }], 32)).toEqual([
      "Give 5-2 a start time.",
      "5-2 isn't a range of draw numbers.",
    ]);
  });
});
