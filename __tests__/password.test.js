const { webcrypto } = require("crypto");
if (!globalThis.crypto?.getRandomValues) globalThis.crypto = webcrypto;

const { generatePassword } = require("../lib/password.ts");

describe("generatePassword", () => {
  test("is three groups of four easy-to-read characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
    }
  });

  test("is different each time", () => {
    const passwords = new Set(Array.from({ length: 50 }, generatePassword));
    expect(passwords.size).toBe(50);
  });
});
