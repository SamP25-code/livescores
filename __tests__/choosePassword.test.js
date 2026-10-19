const { newPasswordProblem, mustChoosePassword } = require("../lib/choosePassword.ts");

describe("choosing your own password", () => {
  test("at least 8 characters, typed the same twice", () => {
    expect(newPasswordProblem("short", "short")).toBe("Use at least 8 characters.");
    expect(newPasswordProblem("longenough", "longenougH")).toBe("The two passwords don't match.");
    expect(newPasswordProblem("longenough", "longenough")).toBeNull();
  });

  test("only logins given a password are asked", () => {
    expect(mustChoosePassword({ app_metadata: { must_choose_password: true } })).toBe(true);
    expect(mustChoosePassword({ app_metadata: { role: "super" } })).toBe(false);
    expect(mustChoosePassword(null)).toBe(false);
  });
});
