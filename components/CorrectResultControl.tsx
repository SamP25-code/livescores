"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import { isNetworkError } from "@/lib/scoreQueue";

// "Correct result" on a finished match (admins). Opens the two scores to
// fix; if the change affects a match that's already started, it says what
// will happen and asks before going ahead. Every correction is logged.
export default function CorrectResultControl({
  nameA,
  nameB,
  scoreA,
  scoreB,
  targetScore,
  onCorrect,
}: {
  nameA: string;
  nameB: string;
  scoreA: number;
  scoreB: number;
  targetScore: number;
  onCorrect: (scoreA: number, scoreB: number, confirmed: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(String(scoreA));
  const [b, setB] = useState(String(scoreB));
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setConfirm(null);
    setError(null);
  }

  async function save(confirmed: boolean) {
    setBusy(true);
    setError(null);
    try {
      await onCorrect(Number(a), Number(b), confirmed);
      close();
    } catch (err) {
      if ((err as { code?: string }).code === "needs_confirmation") setConfirm(errorMessage(err));
      else if (isNetworkError(err)) setError("No signal - try again when you have signal.");
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="link-button correct-result-open"
        onClick={() => {
          setA(String(scoreA));
          setB(String(scoreB));
          setOpen(true);
        }}
      >
        Correct result
      </button>
    );
  }

  const valid = [a, b].every((v) => v.trim() !== "" && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= targetScore);

  return (
    <div className="comp-form-sub correct-result">
      <p>
        <strong>Correct the result</strong>
        <br />
        <span className="hint">Anything this result fed (the next round, Finals Day) updates too. It&rsquo;s logged.</span>
      </p>
      {[
        [nameA, a, setA],
        [nameB, b, setB],
      ].map(([name, value, set], i) => (
        <div key={i} className="player-row">
          <span className="name">{name as string}</span>
          <input
            className="result-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={targetScore}
            aria-label={`Score for ${name as string}`}
            value={value as string}
            disabled={busy || Boolean(confirm)}
            onChange={(e) => (set as (v: string) => void)(e.target.value)}
          />
        </div>
      ))}
      {confirm ? (
        <>
          <p className="correct-result-warning">{confirm}</p>
          <div className="person-check-actions">
            <button type="button" className="danger" disabled={busy} onClick={() => save(true)}>
              {busy ? "Saving…" : "Yes, change it"}
            </button>
            <button type="button" className="link-button" onClick={close}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="person-check-actions">
          <button type="button" disabled={busy || !valid} onClick={() => save(false)}>
            {busy ? "Saving…" : "Save correction"}
          </button>
          <button type="button" className="link-button" onClick={close}>
            Cancel
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
