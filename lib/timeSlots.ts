// Start times for the first round, set by draw number: "1-8 at 10:00,
// 9-16 at 10:45...". A single match's time can be changed by giving it a
// slot of its own (e.g. 9-10 at 11:00) - the narrowest slot covering a match
// wins.

export type TimeSlot = { from_number: number; to_number: number; start_time: string };

// "10:00:00" -> "10:00"
export function shortTime(t: string): string {
  return t.slice(0, 5);
}

// The slot that sets this draw number's start, if any
export function slotForNumber(slots: TimeSlot[], n: number): TimeSlot | null {
  let best: TimeSlot | null = null;
  for (const s of slots) {
    if (n < s.from_number || n > s.to_number) continue;
    if (!best || s.to_number - s.from_number < best.to_number - best.from_number) best = s;
  }
  return best;
}

// A first-round match's start: the time for its first draw number. Slot 0
// is 1 v 2, slot 1 is 3 v 4, and so on.
export function roundOneTime(slots: TimeSlot[], matchSlot: number): string | null {
  const a = slotForNumber(slots, matchSlot * 2 + 1);
  const b = slotForNumber(slots, matchSlot * 2 + 2);
  const chosen = a && b ? (b.to_number - b.from_number < a.to_number - a.from_number ? b : a) : (a ?? b);
  return chosen ? shortTime(chosen.start_time) : null;
}

// Adds minutes to "HH:MM"
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = shortTime(time).split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Quick fill: groups of `perGroup` draw numbers, each `gapMinutes` after the
// last, e.g. 32 in eights from 10:00 every 45 minutes ->
// 1-8 10:00, 9-16 10:45, 17-24 11:30, 25-32 12:15
export function evenSlots(drawSize: number, perGroup: number, firstStart: string, gapMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const size = Math.max(2, perGroup - (perGroup % 2)); // whole matches only
  for (let from = 1, i = 0; from <= drawSize; from += size, i++) {
    slots.push({
      from_number: from,
      to_number: Math.min(drawSize, from + size - 1),
      start_time: addMinutes(firstStart, i * gapMinutes),
    });
  }
  return slots;
}

// Problems with a set of slots before they're saved
export function timeSlotProblems(slots: TimeSlot[], drawSize: number): string[] {
  const problems: string[] = [];
  for (const s of slots) {
    if (!s.start_time) problems.push(`Give ${s.from_number}-${s.to_number} a start time.`);
    if (!Number.isInteger(s.from_number) || !Number.isInteger(s.to_number) || s.from_number < 1 || s.to_number < s.from_number) {
      problems.push(`${s.from_number}-${s.to_number} isn't a range of draw numbers.`);
    } else if (s.to_number > drawSize) {
      problems.push(`${s.from_number}-${s.to_number} goes past ${drawSize}, the size of the draw.`);
    }
  }
  return problems;
}
