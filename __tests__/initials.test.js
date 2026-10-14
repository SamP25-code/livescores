const { getInitials } = require("../components/Avatar.tsx");

describe("getInitials", () => {
  test("first and last name", () => {
    expect(getInitials("Andrew Armstrong")).toBe("AA");
  });

  test("ignores senior/junior endings", () => {
    expect(getInitials("Alan Hodson snr")).toBe("AH");
    expect(getInitials("Alan Hodson jnr")).toBe("AH");
    expect(getInitials("Alan Hodson Snr.")).toBe("AH");
    expect(getInitials("Alan Hodson (jr)")).toBe("AH");
  });

  test("a single name uses its first two letters", () => {
    expect(getInitials("Dave")).toBe("DA");
  });

  test("blank name", () => {
    expect(getInitials("   ")).toBe("?");
  });
});
