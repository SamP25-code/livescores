"use client";

import { EMPTY_PRIZE, STARTER_PRIZES, type PrizeInput } from "@/lib/prizes";

// The prize money rows in a competition's set-up form: each place and its
// amount, in the order shown, plus a line of anything else. All optional -
// often not known until nearer the day, so it can be added later.
export default function PrizeFields({
  id,
  prizes,
  note,
  onChange,
  onNoteChange,
}: {
  id: string;
  prizes: PrizeInput[];
  note: string;
  onChange: (prizes: PrizeInput[]) => void;
  onNoteChange: (note: string) => void;
}) {
  function setPrize(i: number, field: keyof PrizeInput, value: string) {
    onChange(prizes.map((p, j) => (j === i ? { ...p, [field]: value } : p)));
  }

  return (
    <div className="comp-form-prizes">
      {prizes.length === 0 ? (
        <p className="hint">Not known yet? Leave it, and add it here when it is.</p>
      ) : (
        prizes.map((prize, i) => (
          <div key={i} className="comp-form-prize">
            <div className="field">
              <label htmlFor={`${id}-place-${i}`}>Place</label>
              <input
                id={`${id}-place-${i}`}
                placeholder="Winner"
                value={prize.place}
                onChange={(e) => setPrize(i, "place", e.target.value)}
              />
            </div>
            <div className="field comp-form-prize-amount">
              <label htmlFor={`${id}-amount-${i}`}>Amount (£)</label>
              <input
                id={`${id}-amount-${i}`}
                inputMode="decimal"
                placeholder="200"
                value={prize.amount}
                onChange={(e) => setPrize(i, "amount", e.target.value)}
              />
            </div>
            <button
              type="button"
              className="link-button comp-form-remove"
              onClick={() => onChange(prizes.filter((_, j) => j !== i))}
              aria-label={`Remove ${prize.place || `prize ${i + 1}`}`}
            >
              Remove
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        className="link-button"
        onClick={() => onChange(prizes.length === 0 ? STARTER_PRIZES : [...prizes, EMPTY_PRIZE])}
      >
        {prizes.length === 0 ? "+ Add prize money" : "+ Add another place"}
      </button>
      {prizes.length > 0 && (
        <p className="hint">For a prize to each of several players, say so in the place - &ldquo;Semi-finalists (each)&rdquo;.</p>
      )}
      <div className="field">
        <label htmlFor={`${id}-note`}>Anything else about it (optional)</label>
        <input
          id={`${id}-note`}
          placeholder="Depends on entries · trophies to the finalists"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>
    </div>
  );
}
