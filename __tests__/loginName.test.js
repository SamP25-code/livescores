const { loginEmailFor, isNameLogin, NAME_LOGIN_DOMAIN } = require("../lib/loginName.ts");

describe("loginEmailFor", () => {
  test("turns a full name into its stand-in address", () => {
    expect(loginEmailFor("Sam Patterson")).toBe(`sam.patterson@${NAME_LOGIN_DOMAIN}`);
  });

  test("ignores case, extra spaces and punctuation", () => {
    const expected = `sam.patterson@${NAME_LOGIN_DOMAIN}`;
    expect(loginEmailFor("  sam   PATTERSON ")).toBe(expected);
    expect(loginEmailFor("Sam-Patterson")).toBe(expected);
    expect(loginEmailFor("Sam Patterson.")).toBe(expected);
  });

  test("drops apostrophes and accents", () => {
    expect(loginEmailFor("Seán O'Neill")).toBe(`sean.o.neill@${NAME_LOGIN_DOMAIN}`);
  });

  test("passes a real email address straight through", () => {
    expect(loginEmailFor(" someone@example.org ")).toBe("someone@example.org");
  });

  test("is null when nothing usable was typed", () => {
    expect(loginEmailFor("")).toBeNull();
    expect(loginEmailFor("   ")).toBeNull();
    expect(loginEmailFor("!!!")).toBeNull();
  });
});

describe("isNameLogin", () => {
  test("is true for a name and false for an email address", () => {
    expect(isNameLogin("Sam Patterson")).toBe(true);
    expect(isNameLogin("sam@example.org")).toBe(false);
  });
});
