const { displayNameOf, isStandInEmail } = require("../lib/adminUsers.ts");
const { toStaffUser } = require("../lib/staffUsers.ts");
const { NAME_LOGIN_DOMAIN } = require("../lib/loginName.ts");

const standIn = (local) => `${local}@${NAME_LOGIN_DOMAIN}`;

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

describe("toStaffUser", () => {
  test("hides stand-in addresses and keeps real ones", () => {
    const named = toStaffUser(
      {
        id: "1",
        email: standIn("tim.hodge"),
        app_metadata: {},
        user_metadata: { full_name: "Tim Hodge" },
        last_sign_in_at: null,
      },
      [{ competition_id: "march", role: "scorer" }]
    );
    expect(named).toEqual({
      id: "1",
      name: "Tim Hodge",
      email: null,
      isSuper: false,
      lastSignInAt: null,
      assignments: [{ competition_id: "march", role: "scorer" }],
    });
    expect(isStandInEmail(standIn("tim.hodge"))).toBe(true);

    const emailed = toStaffUser(
      {
        id: "2",
        email: "someone@example.org",
        app_metadata: { role: "super" },
        user_metadata: {},
        last_sign_in_at: "2026-10-05T19:00:00Z",
      },
      []
    );
    expect(emailed.email).toBe("someone@example.org");
    expect(emailed.isSuper).toBe(true);
  });
});
