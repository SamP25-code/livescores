"use client";

import { useEffect, useState } from "react";
import { evenSlots, shortTime, timeSlotProblems, type TimeSlot } from "@/lib/timeSlots";

// First-round start times by draw number: "1-8 at 10:00, 9-16 at 10:45...".
// Quick fill for even groups, or set each range by hand. Times for single
// matches changed by hand (two numbers wide) are kept as they are.
export default function TimeSlotsEditor({
  slots,
  drawSize,
  onSave,
}: {
  slots: TimeSlot[];
  drawSize: number;
  onSave: (slots: TimeSlot[]) => Promise<void>;
}) {
  const general = slots.filter((s) => s.to_number - s.from_number > 1);
  const byHand = slots.filter((s) => s.to_number - s.from_number <= 1);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<TimeSlot[]>(general);
  const [group, setGroup] = useState("8");
  const [start, setStart] = useState("10:00");
  const [every, setEvery] = useState("45");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setRows(general);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, editing]);

  const summary = [...general]
    .sort((a, b) => a.from_number - b.from_number)
    .map((s) => `${s.from_number}-${s.to_number} at ${shortTime(s.start_time)}`)
    .join(" · ");

  function setRow(i: number, field: keyof TimeSlot, value: string) {
    setRows((current) =>
      current.map((r, j) => (j === i ? { ...r, [field]: field === "start_time" ? value : Number(value) } : r))
    );
  }

  async function save() {
    const problems = timeSlotProblems(rows, drawSize);
    if (problems.length > 0) {
      setError(problems[0]);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSave([...rows, ...byHand]);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the times.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="card time-slots">
        <div className="time-slots-head">
          <span>
            <strong>Start times</strong>
            <span className="hint">{summary || "Not set - add them for a staggered start."}</span>
          </span>
          <button type="button" className="secondary" onClick={() => setEditing(true)}>
            {general.length ? "Change" : "Set times"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card time-slots">
      <h3>Start times for round 1</h3>
      <p className="hint">By draw number. Later rounds show &ldquo;Time to follow&rdquo;.</p>
      <div className="time-slots-fill">
        <label>
          Groups of
          <input type="number" min={2} step={2} value={group} onChange={(e) => setGroup(e.target.value)} />
        </label>
        <label>
          from
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          every
          <input type="number" min={5} step={5} value={every} onChange={(e) => setEvery(e.target.value)} />
          mins
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => setRows(evenSlots(drawSize, Number(group) || 8, start || "10:00", Number(every) || 45))}
        >
          Fill
        </button>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="time-slots-row">
          <input
            type="number"
            min={1}
            max={drawSize}
            aria-label="From draw number"
            value={r.from_number}
            onChange={(e) => setRow(i, "from_number", e.target.value)}
          />
          <span>to</span>
          <input
            type="number"
            min={1}
            max={drawSize}
            aria-label="To draw number"
            value={r.to_number}
            onChange={(e) => setRow(i, "to_number", e.target.value)}
          />
          <span>at</span>
          <input
            type="time"
            aria-label="Start time"
            value={shortTime(r.start_time)}
            onChange={(e) => setRow(i, "start_time", e.target.value)}
          />
          <button
            type="button"
            className="link-button comp-form-remove"
            onClick={() => setRows((current) => current.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="link-button"
        onClick={() => {
          const last = rows[rows.length - 1];
          const from = last ? last.to_number + 1 : 1;
          setRows([...rows, { from_number: from, to_number: Math.min(drawSize, from + 7), start_time: "" }]);
        }}
      >
        + Add a range
      </button>
      {byHand.length > 0 && (
        <p className="hint">
          {byHand.length} match{byHand.length === 1 ? "'s time has" : "es' times have"} been changed by hand and
          stay as they are.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="person-check-actions">
        <button type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save times"}
        </button>
        <button type="button" className="link-button" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
