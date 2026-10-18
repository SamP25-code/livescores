const {
  settingsProblems,
  finalsFill,
  planSessions,
  longDate,
  sessionName,
  slugify,
  settingsSummary,
} = require("../lib/competitionSetup.ts");

const october = {
  format: "qualifying_and_finals",
  team_size: 1,
  target_score: 21,
  draw_size: 16,
  qualifying_nights: 4,
  entries_per_night: 16,
  qualifiers_per_night: 4,
};

const march = {
  format: "single_day",
  team_size: 2,
  target_score: 21,
  draw_size: 32,
  qualifying_nights: null,
  entries_per_night: null,
  qualifiers_per_night: null,
};

describe("settingsProblems", () => {
  test("the October Singles and the March doubles add up", () => {
    expect(settingsProblems(october)).toEqual([]);
    expect(settingsProblems(march)).toEqual([]);
  });

  test("catches more qualifiers than the Finals Day draw holds", () => {
    const problems = settingsProblems({ ...october, qualifiers_per_night: 7 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/28, more than the Finals Day draw of 16/);
  });

  test("catches everyone going through from a night", () => {
    expect(settingsProblems({ ...october, qualifiers_per_night: 16 })[0]).toMatch(/Fewer have to go through/);
  });

  test("asks for missing numbers", () => {
    expect(settingsProblems({ ...october, qualifying_nights: null })).toEqual([
      "Enter how many qualifying nights there are.",
    ]);
    expect(settingsProblems({ ...march, draw_size: null })).toEqual(["Enter the size of the draw (at least 2)."]);
  });

  test("a final-only competition needs no numbers", () => {
    expect(settingsProblems({ ...march, format: "final_only", draw_size: null })).toEqual([]);
  });
});

describe("finalsFill", () => {
  test("says how the Finals Day draw fills", () => {
    expect(finalsFill(october)).toEqual({ through: 16, byes: 0 });
    expect(finalsFill({ ...october, qualifying_nights: 3 })).toEqual({ through: 12, byes: 4 });
  });

  test("is null for other formats or settings that don't add up", () => {
    expect(finalsFill(march)).toBeNull();
    expect(finalsFill({ ...october, qualifiers_per_night: 7 })).toBeNull();
  });
});

describe("planSessions", () => {
  test("qualifying nights then a Finals Day", () => {
    expect(planSessions("qualifying_and_finals", 4)).toEqual([
      { kind: "qualifier", session_number: 1 },
      { kind: "qualifier", session_number: 2 },
      { kind: "qualifier", session_number: 3 },
      { kind: "qualifier", session_number: 4 },
      { kind: "finals", session_number: 5 },
    ]);
  });

  test("one session for a single day or a final", () => {
    expect(planSessions("single_day", null)).toEqual([{ kind: "single_day", session_number: 1 }]);
    expect(planSessions("final_only", null)).toEqual([{ kind: "final", session_number: 1 }]);
  });
});

describe("dates and names", () => {
  test("long dates match the 2026 nights", () => {
    expect(longDate("2026-10-12")).toBe("Monday 12th October");
    expect(longDate("2026-10-17")).toBe("Saturday 17th October");
    expect(longDate("2027-03-13")).toBe("Saturday 13th March");
    expect(longDate("2027-06-01")).toBe("Tuesday 1st June");
    expect(longDate("2027-06-22")).toBe("Tuesday 22nd June");
    expect(longDate("2027-06-23")).toBe("Wednesday 23rd June");
    expect(longDate("2027-06-11")).toBe("Friday 11th June");
  });

  test("session names", () => {
    expect(sessionName("qualifier", 1, "2026-10-12")).toBe("Monday 12th October");
    expect(sessionName("finals", 5, "2026-10-17")).toBe("Finals Day - Saturday 17th October");
    expect(sessionName("single_day", 1, "2027-03-13")).toBe("Saturday 13th March");
    expect(sessionName("qualifier", 2, null)).toBe("Qualifying night 2");
    expect(sessionName("finals", 5, null)).toBe("Finals Day");
  });

  test("slugs", () => {
    expect(slugify("October Singles")).toBe("october-singles");
    expect(slugify("  Spring Doubles & Pairs! ")).toBe("spring-doubles-and-pairs");
    expect(slugify("St Anne's 31-up Challenge")).toBe("st-anne-s-31-up-challenge");
  });

  test("summaries", () => {
    expect(settingsSummary(october)).toBe("Singles · 4 nights of 16 · 4 through · 16 on Finals Day · 21 up");
    expect(settingsSummary(march)).toBe("Doubles · 32 pairs, one day · 21 up");
    expect(settingsSummary({ ...march, team_size: 1, label: "Ladies" })).toBe("Singles · Ladies · 32 players, one day · 21 up");
  });
});
