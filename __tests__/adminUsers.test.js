const { roleOf, displayNameOf, isStandInEmail, toAdminUser } = require("../lib/adminUsers.ts");
const { NAME_LOGIN_DOMAIN } = require("../lib/loginName.ts");

const standIn = (local) => `${local}@${NAME_LOGIN_DOMAIN}`;

describe("roleOf", () => {
  test("is scorer only when marked as one", () => {
    expect(roleOf({ app_metadata: { role: "scorer" } })).toBe("scorer");
    expect(roleOf({ app_metadata: {} })).toBe("owner");
    expect(roleOf({ app_metadata: { role: null } })).toBe("owner");
  });
});

describe("displayNameOf", () => {
  test("prefers the full name saved when the login was added", () => {
    expect(displayNameOf({ email: standIn("sam.patterson"), user_metadata: { full_name: "Sam Patterson" } })).toBe(
      "Sam Patterson"
    );
  });

  test("rebuilds a name from a stand-in address", () => {
    expect(displayNameOf({ email: standIn("wayne.ditchfield"), user_metadata: {} })).toBe("Wayne Ditchfield");
  });

  test("falls back to a real email address", () => {
    expect(displayNameOf({ email: "someone@example.org", user_metadata: {} })).toBe("someone@example.org");
  });
});

describe("toAdminUser", () => {
  test("hides stand-in addresses and keeps real ones", () => {
    const named = toAdminUser({
      id: "1",
      email: standIn("tim.hodge"),
      app_metadata: { role: "scorer" },
      user_metadata: { full_name: "Tim Hodge" },
      last_sign_in_at: null,
    });
    expect(named).toEqual({ id: "1", name: "Tim Hodge", email: null, role: "scorer", lastSignInAt: null });
    expect(isStandInEmail(standIn("tim.hodge"))).toBe(true);

    const emailed = toAdminUser({
      id: "2",
      email: "someone@example.org",
      app_metadata: {},
      user_metadata: {},
      last_sign_in_at: "2026-10-05T19:00:00Z",
    });
    expect(emailed.email).toBe("someone@example.org");
    expect(emailed.role).toBe("owner");
  });
});
