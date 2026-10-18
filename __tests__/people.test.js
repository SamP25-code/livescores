const {
  normaliseName,
  tidyName,
  matchesSearch,
  rankMatches,
  sameNamePeople,
  monthYear,
  personDetailsLine,
  newPersonProblem,
  distinguishedNames,
  entryName,
  entryProblem,
  entryCapacity,
} = require("../lib/people.ts");

describe("names as typed", () => {
  test("normalise for comparing", () => {
    expect(normaliseName("  Wayne   DITCHFIELD ")).toBe("wayne ditchfield");
  });

  test("tidy capitalises names typed all in one case", () => {
    expect(tidyName("wayne ditchfield")).toBe("Wayne Ditchfield");
    expect(tidyName("WAYNE  DITCHFIELD ")).toBe("Wayne Ditchfield");
    expect(tidyName("o'brien-smith")).toBe("O'Brien-Smith");
  });

  test("tidy leaves mixed case alone", () => {
    expect(tidyName("Ian McDonald")).toBe("Ian McDonald");
    expect(tidyName(" Rui  de Souza")).toBe("Rui de Souza");
  });
});

describe("search", () => {
  const people = [
    { id: "1", full_name: "Wayne Ditchfield", last_played: "2026-10-12" },
    { id: "2", full_name: "John Smith", last_played: "2026-10-13" },
    { id: "3", full_name: "John Smith", last_played: "2027-06-01" },
    { id: "4", full_name: "Johnny Walker", last_played: null },
    { id: "5", full_name: "Mary-Jo Johnson", last_played: null },
  ];

  test("matches the start of any word, in any order", () => {
    expect(matchesSearch("Wayne Ditchfield", "ditch")).toBe(true);
    expect(matchesSearch("Wayne Ditchfield", "w ditch")).toBe(true);
    expect(matchesSearch("Wayne Ditchfield", "ditchfield wayne")).toBe(true);
    expect(matchesSearch("Wayne Ditchfield", "field")).toBe(false);
    expect(matchesSearch("Mary-Jo Johnson", "jo")).toBe(true);
    expect(matchesSearch("Wayne Ditchfield", "  ")).toBe(false);
  });

  test("exact names first, the most recent player first among the same name", () => {
    expect(rankMatches(people, "john smith").map((p) => p.id)).toEqual(["3", "2"]);
    expect(rankMatches(people, "john").map((p) => p.id)).toEqual(["3", "2", "4", "5"]);
  });

  test("same-name check ignores case and spacing", () => {
    expect(sameNamePeople(people, " JOHN  smith").map((p) => p.id)).toEqual(["2", "3"]);
    expect(sameNamePeople(people, "John Smyth")).toEqual([]);
  });
});

describe("telling people apart", () => {
  test("details line", () => {
    expect(monthYear("2026-10-17")).toBe("Oct 2026");
    expect(personDetailsLine({ club_name: "Penwortham", note: "Snr", last_played: "2026-10-17" })).toBe(
      "Penwortham · Snr · last played Oct 2026"
    );
    expect(personDetailsLine({ club_name: null, note: null, last_played: null })).toBe("not played yet");
  });

  test("a new person with a new name needs nothing extra", () => {
    expect(newPersonProblem("Lee Hanson", null, null, [])).toBeNull();
    expect(newPersonProblem("   ", null, null, [])).toBe("Enter their full name.");
  });

  test("a second John Smith needs a club or a note that differs", () => {
    const existing = [{ note: null, club_id: "penwortham" }];
    expect(newPersonProblem("John Smith", null, "", existing)).toMatch(/add their club or a short note/);
    expect(newPersonProblem("John Smith", "st-annes", null, existing)).toBeNull();
    expect(newPersonProblem("John Smith", "penwortham", "Jnr", existing)).toBeNull();
    expect(newPersonProblem("John Smith", "penwortham", null, existing)).toMatch(/match the existing person/);
  });

  test("pages add the club or note only when two people share a name", () => {
    const shown = distinguishedNames([
      { id: "1", full_name: "John Smith", note: null, club_name: "Penwortham" },
      { id: "2", full_name: "John Smith", note: "Jnr", club_name: "Penwortham" },
      { id: "3", full_name: "Wayne Ditchfield", note: null, club_name: "Penwortham" },
    ]);
    expect(shown.get("1")).toBe("John Smith (Penwortham)");
    expect(shown.get("2")).toBe("John Smith (Jnr)");
    expect(shown.get("3")).toBe("Wayne Ditchfield");
  });
});

describe("entries", () => {
  test("pair names", () => {
    expect(entryName("Wayne Ditchfield")).toBe("Wayne Ditchfield");
    expect(entryName("Wayne Ditchfield", "Lee Hanson")).toBe("Wayne Ditchfield & Lee Hanson");
  });

  test("checks before saving", () => {
    expect(entryProblem(1, "a", null)).toBeNull();
    expect(entryProblem(1, null, null)).toBe("Choose the player.");
    expect(entryProblem(2, "a", null)).toBe("Choose both players in the pair.");
    expect(entryProblem(2, "a", "a")).toBe("Choose two different people for the pair.");
    expect(entryProblem(2, "a", "b")).toBeNull();
  });

  test("how many entries fit", () => {
    expect(entryCapacity({ format: "single_day", draw_size: 32, qualifying_nights: null, entries_per_night: null })).toBe(32);
    expect(entryCapacity({ format: "qualifying_and_finals", draw_size: 16, qualifying_nights: 4, entries_per_night: 16 })).toBe(64);
    expect(entryCapacity({ format: "final_only", draw_size: 2, qualifying_nights: null, entries_per_night: null })).toBe(2);
  });
});
