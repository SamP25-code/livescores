const { directionsUrl, checkMapUrl, venueAddressLine, postponedLabel, originalDateLabel } = require("../lib/venues.ts");

const club = { name: "Penwortham Sports & Social Club", address: "Hill Road, Penwortham", postcode: "PR1 9XH" };

describe("directions", () => {
  test("searches the address in Google Maps", () => {
    expect(directionsUrl(club)).toBe(
      "https://www.google.com/maps/search/?api=1&query=Penwortham%20Sports%20%26%20Social%20Club%2C%20Hill%20Road%2C%20Penwortham%2C%20PR1%209XH"
    );
  });

  test("a pasted maps link wins", () => {
    expect(directionsUrl({ ...club, map_url: "https://maps.app.goo.gl/abc123" })).toBe("https://maps.app.goo.gl/abc123");
  });

  test("with only a name", () => {
    expect(directionsUrl({ name: "Greenlands", address: null, postcode: "  " })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Greenlands"
    );
  });

  test("checking a pasted link", () => {
    expect(checkMapUrl("  ")).toEqual({ url: null, problem: null });
    expect(checkMapUrl(" https://maps.app.goo.gl/abc123 ")).toEqual({ url: "https://maps.app.goo.gl/abc123", problem: null });
    expect(checkMapUrl("maps.app.goo.gl/abc").problem).toMatch(/doesn't look like a link/);
    expect(checkMapUrl("http://maps.google.com/x").problem).toMatch(/https/);
  });

  test("address line", () => {
    expect(venueAddressLine(club)).toBe("Penwortham Sports & Social Club, Hill Road, Penwortham PR1 9XH");
    expect(venueAddressLine({ name: "Greenlands", address: null, postcode: null })).toBe("Greenlands");
  });
});

describe("postponements", () => {
  test("rained off with a new date", () => {
    expect(
      postponedLabel({ postponed: true, postponed_reason: "Rained off", date: "2027-06-10", original_date: "2027-06-07" })
    ).toBe("Rained off - now Thursday 10th June");
    expect(originalDateLabel({ postponed: true, original_date: "2027-06-07" })).toBe("Was Monday 7th June");
  });

  test("new date not known yet", () => {
    expect(postponedLabel({ postponed: true, postponed_reason: "", date: null })).toBe(
      "Postponed - new date to be confirmed"
    );
  });

  test("not postponed", () => {
    expect(postponedLabel({ postponed: false, date: "2027-06-07" })).toBeNull();
    expect(originalDateLabel({ postponed: false, original_date: "2027-06-07" })).toBeNull();
  });
});
