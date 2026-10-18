const { pageRoleFor, isAnyAdmin, accessLabel, visibleCompetition } = require("../lib/access.ts");

const make = (over) => ({ userId: "u", isSuper: false, roles: new Map(), legacyRole: "owner", ...over });

describe("access", () => {
  const sam = make({ isSuper: true });
  const wayne = make({ roles: new Map([["march", "admin"], ["october", "scorer"]]) });
  const helper = make({ roles: new Map([["march", "scorer"]]), legacyRole: "scorer" });
  const nobody = make({});

  test("Super runs everything", () => {
    expect(pageRoleFor(sam, "march")).toBe("owner");
    expect(pageRoleFor(sam, null)).toBe("owner");
    expect(visibleCompetition(sam, "anything")).toBe(true);
    expect(accessLabel(sam)).toBe("Super");
  });

  test("admin on one competition, scorer on another, nothing elsewhere", () => {
    expect(pageRoleFor(wayne, "march")).toBe("owner");
    expect(pageRoleFor(wayne, "october")).toBe("scorer");
    expect(pageRoleFor(wayne, "blackpool")).toBeNull();
    expect(visibleCompetition(wayne, "blackpool")).toBe(false);
    expect(isAnyAdmin(wayne)).toBe(true);
    expect(accessLabel(wayne)).toBe("Admin");
  });

  test("a scorer only scores", () => {
    expect(pageRoleFor(helper, "march")).toBe("scorer");
    expect(isAnyAdmin(helper)).toBe(false);
    expect(accessLabel(helper)).toBe("Scorer");
  });

  test("old nights with no competition use the old mark on the login", () => {
    expect(pageRoleFor(helper, null)).toBe("scorer");
    expect(pageRoleFor(nobody, undefined)).toBe("owner");
    expect(pageRoleFor(nobody, "march")).toBeNull();
  });
});
