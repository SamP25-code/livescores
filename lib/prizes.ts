// A competition's prize money: places and amounts in the order shown, e.g.
// Winner £200, Runner-up £100, Semi-finalists £50 each (migration 2027_22).

export type Prize = { place: string; amount: number };

// A row as typed in the set-up form: the amount still as text
export type PrizeInput = { place: string; amount: string };

export const EMPTY_PRIZE: PrizeInput = { place: "", amount: "" };

// A first go at the rows, when adding prize money to a competition
export const STARTER_PRIZES: PrizeInput[] = [
  { place: "Winner", amount: "" },
  { place: "Runner-up", amount: "" },
];

// "£200", "£12.50", "£1,000"
export function pounds(amount: number): string {
  const whole = Number.isInteger(amount);
  return `£${amount.toLocaleString("en-GB", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// The form's rows ready to save: blank rows dropped, amounts read as pounds
// ("£200", "1,000" and "50.00" all fine). A problem with a row comes back as
// a message instead; no rows at all saves as null.
export function readPrizes(rows: PrizeInput[]): { prizes: Prize[] | null } | { problem: string } {
  const prizes: Prize[] = [];
  for (const row of rows) {
    const place = row.place.trim();
    const typed = row.amount.trim().replace(/[£,\s]/g, "");
    if (!place && !typed) continue;
    if (!place) return { problem: `Say which place gets ${row.amount.trim()}.` };
    if (!typed) return { problem: `Enter the prize money for ${place}.` };
    const amount = Number(typed);
    if (!/^\d+(\.\d{1,2})?$/.test(typed) || !Number.isFinite(amount)) {
      return { problem: `The prize money for ${place} needs to be an amount in pounds, like 200 or 12.50.` };
    }
    prizes.push({ place, amount });
  }
  return { prizes: prizes.length > 0 ? prizes : null };
}

// Saved prizes back into form rows
export function prizeRows(prizes: Prize[] | null | undefined): PrizeInput[] {
  return (prizes ?? []).map((p) => ({ place: p.place, amount: String(p.amount) }));
}
