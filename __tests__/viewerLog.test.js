jest.mock("../lib/supabaseClient.ts", () => ({ supabase: {} }));

const { buildViewerSeries, peakOf, pointAt } = require("../lib/viewerLog.ts");

const at = (hhmm) => `2026-10-12T${hhmm}:00.000Z`;
const ms = (hhmm) => new Date(at(hhmm)).getTime();

describe("buildViewerSeries", () => {
  test("returns nothing for an empty log", () => {
    expect(buildViewerSeries([])).toEqual([]);
  });

  test("one point per minute, in order, from first to last ping", () => {
    const series = buildViewerSeries([
      { minute: at("19:02"), viewers: 5 },
      { minute: at("19:00"), viewers: 3 },
      { minute: at("19:01"), viewers: 4 },
    ]);
    expect(series).toEqual([
      { time: ms("19:00"), viewers: 3 },
      { time: ms("19:01"), viewers: 4 },
      { time: ms("19:02"), viewers: 5 },
    ]);
  });

  test("fills minutes nobody was watching with 0 instead of skipping them", () => {
    const series = buildViewerSeries([
      { minute: at("19:00"), viewers: 2 },
      { minute: at("19:03"), viewers: 6 },
    ]);
    expect(series.map((p) => p.viewers)).toEqual([2, 0, 0, 6]);
  });
});

describe("peakOf", () => {
  test("is null for an empty series", () => {
    expect(peakOf([])).toBeNull();
  });

  test("finds the busiest minute, the earliest if the peak repeats", () => {
    const series = buildViewerSeries([
      { minute: at("19:00"), viewers: 2 },
      { minute: at("19:01"), viewers: 9 },
      { minute: at("19:02"), viewers: 9 },
      { minute: at("19:03"), viewers: 4 },
    ]);
    expect(peakOf(series)).toEqual({ time: ms("19:01"), viewers: 9 });
  });
});

describe("pointAt", () => {
  const series = buildViewerSeries([
    { minute: at("19:00"), viewers: 2 },
    { minute: at("19:01"), viewers: 7 },
    { minute: at("19:02"), viewers: 4 },
  ]);

  test("is null for an empty series", () => {
    expect(pointAt([], ms("19:00"))).toBeNull();
  });

  test("returns the minute containing the time", () => {
    expect(pointAt(series, ms("19:01")).viewers).toBe(7);
    expect(pointAt(series, ms("19:01") + 59_000).viewers).toBe(7);
  });

  test("clamps times before or after the log to its ends", () => {
    expect(pointAt(series, ms("18:30")).viewers).toBe(2);
    expect(pointAt(series, ms("21:00")).viewers).toBe(4);
  });
});
