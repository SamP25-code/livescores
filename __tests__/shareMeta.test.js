// What shared links show: each page's own title, from small lookups
let rows = {};
jest.mock("../lib/supabaseClient.ts", () => {
  const query = (table) => {
    const filters = {};
    const q = {
      select: () => q,
      eq: (col, val) => {
        filters[col] = val;
        return q;
      },
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: (rows[table] ?? []).find((r) => matches(r, filters)) ?? null }),
      then: (resolve) => resolve({ data: (rows[table] ?? []).filter((r) => matches(r, filters)) }),
    };
    return q;
  };
  const matches = (r, filters) =>
    Object.entries(filters).every(([col, val]) => col.split(".").reduce((o, k) => o?.[k], r) === val);
  return { supabase: { from: query } };
});

const { shareMetadata, addressShare, sessionShare, postShare, playerShare } = require("../lib/shareMeta.ts");

beforeEach(() => {
  rows = {};
});

test("a page's own title, its line, and the site's picture when it has none", () => {
  const m = shareMetadata({ title: "October Singles 2026", description: "Live scores" });
  expect(m.title).toBe("October Singles 2026 · Crown Green Live");
  expect(m.openGraph.title).toBe("October Singles 2026");
  expect(m.openGraph.images).toEqual(["/bowls-background.jpg"]);
  expect(shareMetadata({ title: "News", description: "x", image: "https://pic" }).openGraph.images).toEqual(["https://pic"]);
  expect(shareMetadata(null)).toEqual({});
});

test("a competition by its address, with or without the year", async () => {
  const series = { slug: "october-singles", name: "October Singles", organiser: { name: "Penwortham SSC", short_name: "Penwortham", kind: "club" } };
  rows.competitions = [{ year: 2026, series }];
  expect(await addressShare("october-singles")).toEqual({
    title: "October Singles 2026",
    description: "Live scores, the draw and results · Penwortham",
  });
  expect((await addressShare("october-singles-2026")).title).toBe("October Singles 2026");
  expect(await addressShare("nowhere")).toBeNull();
});

test("an event by its address", async () => {
  rows.organisers = [{ id: "bm", name: "Blackpool Masters", slug: "blackpool-masters", kind: "event" }];
  rows.competitions = [{ year: 2027, series: { organiser_id: "bm" } }];
  expect((await addressShare("blackpool-masters")).title).toBe("Blackpool Masters 2027");
});

test("a session, a post and a player", async () => {
  rows.nights = [
    { id: "n1", kind: "qualifier", session_number: 3, date: "2026-10-12", competition: { year: 2026, series: { name: "October Singles" } } },
  ];
  const s = await sessionShare("n1");
  expect(s.title).toBe("October Singles 2026 · Session 3");
  expect(s.description).toMatch(/12.*October.*Live scores and the draw/);

  rows.event_posts = [{ id: "p1", title: "Qualifiers announced", body: "The list\n\nis out.", image_url: null }];
  expect(await postShare("p1")).toEqual({ title: "Qualifiers announced", description: "The list is out.", image: null });

  rows.people = [
    { id: "a", full_name: "Phil Lee", hidden: false },
    { id: "b", full_name: "Someone", hidden: true },
  ];
  expect((await playerShare("a")).title).toBe("Phil Lee");
  expect(await playerShare("b")).toBeNull();
});
