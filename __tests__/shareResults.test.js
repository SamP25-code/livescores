const { competitionShareText, matchLine, sessionShareText } = require("../lib/shareResults.ts");

const m = (round, slot, a, b, sa, sb, status = "complete") => ({
  round,
  slot,
  status,
  player_a_id: a,
  player_b_id: b,
  score_a: sa,
  score_b: sb,
  winner_id: status === "complete" ? (sa > sb ? a : sb > sa ? b : a) : null,
});
const names = { w: "Wayne Ditchfield", o: "Owen Jackson", e: "Eamon Hernen", t: "Terry McMullan" };

describe("share results", () => {
  test("a match: the winner first; in play; still to play; a walkover; a bye", () => {
    expect(matchLine(m(1, 0, "o", "w", 16, 21), names)).toBe("Wayne Ditchfield 21–16 Owen Jackson");
    expect(matchLine(m(1, 0, "w", "o", 12, 9, "live"), names)).toBe("Wayne Ditchfield 12–9 Owen Jackson (in play)");
    expect(matchLine(m(1, 0, "w", "o", 0, 0, "upcoming"), names)).toBe("Wayne Ditchfield v Owen Jackson");
    expect(matchLine({ ...m(1, 0, "w", "o", 0, 0), winner_id: "o" }, names)).toBe("Owen Jackson - walkover (Wayne Ditchfield didn't play)");
    expect(matchLine(m(1, 0, "w", null, 0, 0), names)).toBeNull();
  });

  test("Finals Day: the champion, then the final down to the first round", () => {
    const text = sessionShareText({
      title: "October Singles 2026 – Finals Day",
      date: "Saturday 17 October",
      kind: "finals",
      matches: [m(1, 0, "w", "e", 21, 16), m(1, 1, "o", "t", 21, 14), m(2, 0, "w", "o", 21, 16)],
      names,
      champion: "Wayne Ditchfield",
      runnerUp: "Owen Jackson",
      through: [],
      url: "https://example.com/night/1",
    });
    expect(text).toBe(
      [
        "October Singles 2026 – Finals Day",
        "Saturday 17 October",
        "",
        "Champion: Wayne Ditchfield (runner-up Owen Jackson)",
        "",
        "Final",
        "Wayne Ditchfield 21–16 Owen Jackson",
        "",
        "Semi-Final",
        "Wayne Ditchfield 21–16 Eamon Hernen",
        "Owen Jackson 21–14 Terry McMullan",
        "",
        "Full results: https://example.com/night/1",
      ].join("\n")
    );
  });

  test("a qualifying session: who's through", () => {
    const text = sessionShareText({
      title: "Floodlit Singles 2027 – Session 1",
      date: null,
      kind: "qualifier",
      matches: [m(1, 0, "w", "e", 21, 3)],
      names,
      champion: null,
      runnerUp: null,
      through: ["Wayne Ditchfield"],
      url: "u",
    });
    expect(text).toBe(["Floodlit Singles 2027 – Session 1", "", "Through to Finals Day: Wayne Ditchfield", "", "Round 1", "Wayne Ditchfield 21–3 Eamon Hernen", "", "Full results: u"].join("\n"));
  });

  test("a competition: its champion, or what's next", () => {
    expect(competitionShareText({ title: "Spring Doubles 2027", runBy: "Penwortham", champion: null, runnerUp: null, next: "One day · Sat 13 Mar", url: "u" })).toBe(
      "Spring Doubles 2027\nPenwortham\n\nNext: One day · Sat 13 Mar\n\nu"
    );
  });
});
