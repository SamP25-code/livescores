// Passwords the admin hands on to someone, so they need to survive being
// read out or texted: lowercase letters and digits only, no look-alikes
// (0/o, 1/l/i), in three groups of four - e.g. "k7pm-x3rq-9tw4".
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const GROUPS = 3;
const GROUP_LENGTH = 4;

export function generatePassword(): string {
  const bytes = new Uint32Array(GROUPS * GROUP_LENGTH);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i++) {
    groups.push(chars.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH).join(""));
  }
  return groups.join("-");
}
