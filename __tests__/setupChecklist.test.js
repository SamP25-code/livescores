const { setupChecklist } = require("../lib/setupChecklist.ts");

describe("a competition's set-up checklist", () => {
  test("a one-day competition part-way set up", () => {
    const items = setupChecklist({
      sessions: [{ date: "2027-03-13" }],
      venueId: null,
      movesBetweenClubs: false,
      entered: 12,
      capacity: 32,
      admins: 0,
      qualification: false,
      qualifyingPlaces: 0,
    });
    expect(items.map((i) => `${i.label}: ${i.detail} ${i.done ? "done" : "to do"}`)).toEqual([
      "Dates: All set done",
      "Where it's played: Not set yet to do",
      "Entries: 12 of 32 to do",
      "Admin: Nobody assigned yet to do",
    ]);
  });

  test("entered by qualification, and a county one moving between clubs", () => {
    const items = setupChecklist({
      sessions: [{ date: "2027-05-01", venue_id: "a" }, { date: null, venue_id: null }],
      venueId: null,
      movesBetweenClubs: true,
      entered: 0,
      capacity: 32,
      admins: 1,
      qualification: true,
      qualifyingPlaces: 0,
    });
    expect(items.map((i) => `${i.label}: ${i.detail}`)).toEqual([
      "Dates: 1 of 2 set",
      "Where it's played: 1 of 2 sessions",
      "Qualifying competitions: None added yet",
      "Admin: 1 assigned",
    ]);
    expect(items.find((i) => i.label === "Qualifying competitions").tab).toBe("qualifying");
  });
});
