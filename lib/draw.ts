// Making a draw: every place gets a draw number. Numbers left unused are
// byes, and the bracket is built by number (1 v 2, 3 v 4, ...). Works the
// same whether the numbers came from "Draw at random" or were read off a
// physical draw at the green.
import { nextPowerOfTwo } from "@/lib/bracket";

// The size of the draw for this many entries: the next power of two
// (30 pairs -> a draw of 32 with 2 byes)
export function drawSizeFor(count: number): number {
  return nextPowerOfTwo(Math.max(2, count));
}

// A fair shuffle. `random` is there so tests can pass a fixed sequence.
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Draws everyone at random. Byes are spread so no two meet each other:
// each bye goes in a different match, against someone, and which matches
// get them is random too.
export function randomDrawNumbers(ids: string[], random: () => number = Math.random): Map<string, number> {
  const size = drawSizeFor(ids.length);
  const matches = size / 2;
  const byes = size - ids.length;
  const byeMatches = new Set(shuffle([...Array(matches).keys()], random).slice(0, byes));
  const open: number[] = [];
  for (let m = 0; m < matches; m++) {
    if (byeMatches.has(m)) {
      // One side of this match stays empty - either side
      open.push(m * 2 + (random() < 0.5 ? 1 : 2));
    } else {
      open.push(m * 2 + 1, m * 2 + 2);
    }
  }
  const order = shuffle(ids, random);
  return new Map(order.map((id, i) => [id, open[i]]));
}

// What's wrong with a set of drawn numbers, if anything - checked before the
// draw is confirmed.
export function drawNumberProblems(numbers: (number | null)[]): string[] {
  const problems: string[] = [];
  const size = drawSizeFor(numbers.length);
  const missing = numbers.filter((n) => n == null).length;
  if (missing > 0) problems.push(`${missing} still to be given a number.`);
  const seen = new Set<number>();
  for (const n of numbers) {
    if (n == null) continue;
    if (n < 1 || n > size) problems.push(`Number ${n} is outside the draw of ${size}.`);
    else if (seen.has(n)) problems.push(`Number ${n} is given out twice.`);
    seen.add(n);
  }
  if (missing === 0) {
    for (let m = 0; m < size / 2; m++) {
      if (!seen.has(m * 2 + 1) && !seen.has(m * 2 + 2)) {
        problems.push(`Nobody has ${m * 2 + 1} or ${m * 2 + 2}, so that match would be two byes.`);
      }
    }
  }
  return problems;
}

// The bracket's first-round places, by draw number: index 0 is number 1.
// Empty places are byes.
export function slotsByNumber<T extends { seed: number | null; is_bye?: boolean }>(players: T[]): Array<T | null> {
  const active = players.filter((p) => !p.is_bye);
  const top = Math.max(0, ...active.map((p) => p.seed ?? 0));
  const size = drawSizeFor(Math.max(top, active.length));
  const slots: Array<T | null> = Array(size).fill(null);
  for (const p of players) {
    if (p.seed != null && !p.is_bye) slots[p.seed - 1] = p;
  }
  return slots;
}

// Every place has a number (places marked as a bye don't need one) - the
// draw is made by number, not list order
export function drawnByNumber(players: { seed: number | null; is_bye?: boolean }[]): boolean {
  const active = players.filter((p) => !p.is_bye);
  return active.length > 0 && active.every((p) => p.seed != null);
}
