"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import type { PersonDetails } from "@/lib/people";
import { updatePerson } from "@/lib/peopleApi";
import type { Organiser } from "@/lib/types";

// Corrects one person's name, club or note - e.g. a misspelled name. It's the
// same person everywhere they've played, so it changes on every page. An
// admin can only correct people entered just in competitions they run.
export default function PersonDetailsEditor({
  person,
  clubs,
  onSaved,
}: {
  person: PersonDetails;
  clubs: Organiser[];
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: person.full_name, club_id: person.club_id ?? "", note: person.note ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `pd-${person.id}`;

  if (!open) {
    return (
      <button
        type="button"
        className="link-button person-details-open"
        onClick={() => {
          setForm({ full_name: person.full_name, club_id: person.club_id ?? "", note: person.note ?? "" });
          setError(null);
          setOpen(true);
        }}
      >
        Correct {person.full_name}&rsquo;s name or club
      </button>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updatePerson(person.id, { full_name: form.full_name, club_id: form.club_id || null, note: form.note });
      setOpen(false);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="comp-form-sub person-details">
      <div className="field">
        <label htmlFor={`${id}-name`}>Full name</label>
        <input id={`${id}-name`} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div className="comp-form-grid">
        <div className="field">
          <label htmlFor={`${id}-club`}>Club</label>
          <select id={`${id}-club`} value={form.club_id} onChange={(e) => setForm({ ...form, club_id: e.target.value })}>
            <option value="">Not known</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.short_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-note`}>Note</label>
          <input
            id={`${id}-note`}
            placeholder="e.g. Snr"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
      </div>
      <p className="hint">This is the same person on every page they appear on, so it changes everywhere.</p>
      {error && <p className="error">{error}</p>}
      <div className="person-check-actions">
        <button type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save details"}
        </button>
        <button type="button" className="link-button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
