const { visibleTo, canResetPassword, canAssign } = require("../lib/staffUsers.ts");

const sam = { id: "sam", isSuper: true, adminOf: new Set(["march", "october"]) };
const wayne = { id: "wayne", isSuper: false, adminOf: new Set(["march"]) };

const helper = {
  id: "helper",
  name: "Helper",
  isSuper: false,
  assignments: [
    { competition_id: "march", role: "scorer" },
    { competition_id: "october", role: "scorer" },
  ],
};
const otherAdmin = { id: "other", name: "Other", isSuper: false, assignments: [{ competition_id: "march", role: "admin" }] };
const stranger = { id: "stranger", name: "Stranger", isSuper: false, assignments: [{ competition_id: "october", role: "scorer" }] };

describe("what an admin sees on Users", () => {
  test("Super sees everyone, everything", () => {
    expect(visibleTo(helper, sam)).toEqual(helper);
  });

  test("an admin sees only their own competitions' assignments", () => {
    expect(visibleTo(helper, wayne).assignments).toEqual([{ competition_id: "march", role: "scorer" }]);
    expect(visibleTo(stranger, wayne)).toBeNull();
    expect(visibleTo({ id: "wayne", isSuper: false, assignments: [] }, wayne)).not.toBeNull();
  });
});

describe("new passwords", () => {
  test("an admin can reset only people who just score for them", () => {
    expect(canResetPassword({ id: "s", isSuper: false, assignments: [{ competition_id: "march", role: "scorer" }] }, wayne)).toBe(true);
    expect(canResetPassword(helper, wayne)).toBe(false); // also scores October, which Wayne doesn't run
    expect(canResetPassword(otherAdmin, wayne)).toBe(false);
    expect(canResetPassword({ id: "sam", isSuper: true, assignments: [] }, wayne)).toBe(false);
    expect(canResetPassword({ id: "wayne", isSuper: false, assignments: [] }, wayne)).toBe(true);
  });

  test("Super can reset anyone", () => {
    expect(canResetPassword(otherAdmin, sam)).toBe(true);
  });
});

describe("assigning", () => {
  test("an admin adds scorers to their own competitions only", () => {
    expect(canAssign("march", "scorer", wayne)).toBe(true);
    expect(canAssign("march", "admin", wayne)).toBe(false);
    expect(canAssign("october", "scorer", wayne)).toBe(false);
    expect(canAssign("october", "admin", sam)).toBe(true);
  });
});
