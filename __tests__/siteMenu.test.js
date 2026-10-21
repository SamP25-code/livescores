const { clubs, menuEvents, menuItems, searchMenu } = require("../lib/siteMenu.ts");

const club = { id: "pen", name: "Penwortham SSC", short_name: "Penwortham", kind: "club", slug: "penwortham" };
const event = { id: "bm", name: "Blackpool Masters", short_name: "Blackpool Masters", kind: "event", slug: "blackpool-masters" };
const c = (id, name, slug, year, organiser, sessions = []) => ({ id, name, slug, year, organiser, sessions });

const all = [
  c("o26", "October Singles", "october-singles", 2026, club),
  c("o27", "October Singles", "october-singles", 2027, club),
  c("jr", "Jack Rees Doubles", "jack-rees-doubles", 2027, club),
  c("inv", "Masters Invitation 32", "masters-invitation-32", 2027, event, [{ date: "2027-09-18" }]),
  c("l32", "Ladies 32", "ladies-32", 2027, event, [{ date: "2027-09-19" }]),
];

describe("side menu search", () => {
  const items = menuItems(all);

  test("one entry per competition (latest year), per event and per club", () => {
    expect(items.map((i) => `${i.title} | ${i.detail} | ${i.href}`)).toEqual([
      "Blackpool Masters | Event · 2 competitions · 2027 | /blackpool-masters",
      "Jack Rees Doubles | Penwortham · 2027 | /jack-rees-doubles",
      "October Singles | Penwortham · 2027 | /october-singles",
      "Penwortham SSC | Club · 2 competitions | /clubs/penwortham",
    ]);
  });

  test("narrows as you type", () => {
    expect(searchMenu(items, "o").map((i) => i.title)).toEqual(["October Singles"]);
    expect(searchMenu(items, "blackp").map((i) => i.title)).toEqual(["Blackpool Masters"]);
    expect(searchMenu(items, "")).toEqual([]);
  });

  test("a club's name finds the club and all its competitions", () => {
    expect(searchMenu(items, "pen").map((i) => i.title)).toEqual(["Jack Rees Doubles", "October Singles", "Penwortham SSC"]);
  });

  test("the Clubs page: each club once, A to Z, competitions counted once across years", () => {
    expect(clubs(all)).toEqual([{ id: "pen", name: "Penwortham SSC", short_name: "Penwortham", href: "/clubs/penwortham", count: 2 }]);
  });

  test("the menu's events: dates, and their competitions in date order", () => {
    expect(menuEvents(all)).toEqual([
      {
        title: "Blackpool Masters",
        dates: "Sat 18 – Sun 19 Sep",
        href: "/blackpool-masters",
        competitions: [
          { title: "Masters Invitation 32", href: "/masters-invitation-32" },
          { title: "Ladies 32", href: "/ladies-32" },
        ],
      },
    ]);
  });
});
