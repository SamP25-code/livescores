"use client";

import { useEffect, useState } from "react";
import PersonPicker from "@/components/PersonPicker";
import { errorMessage } from "@/lib/errors";
import { deletePastWinner, listPastWinners, savePastWinner, type PastWinner } from "@/lib/honoursApi";
import { listClubs } from "@/lib/peopleApi";
import type { PersonDetails } from "@/lib/people";
import type { Organiser } from "@/lib/types";

type Picked = PersonDetails | null;
type Form = { year: string; winner: Picked; winnerPartner: Picked; runnerUp: Picked; runnerUpPartner: Picked };
const EMPTY: Form = { year: "", winner: null, winnerPartner: null, runnerUp: null, runnerUpPartner: null };

// Someone already on the list, as the picker shows them
function known(id: string | null, names: Record<string, string>): Picked {
  if (!id) return null;
  return { id, full_name: names[id] ?? "?", note: null, club_id: null, club_name: null, last_played: null };
}

// A competition's honours board before the site (Super): add a year with
// its winner and runner-up - picked like any entry, so each links to their
// player page, and someone new is added there and then. Years played on the
// site fill themselves in and don't need adding.
export default function PastWinners({ seriesId, seriesName, doubles }: { seriesId: string; seriesName: string; doubles: boolean }) {
  const [rows, setRows] = useState<PastWinner[] | null>(null);
  const [clubs, setClubs] = useState<Organiser[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await listPastWinners(seriesId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
    listClubs()
      .then(setClubs)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  function change(r: PastWinner) {
    setError(null);
    setMessage(null);
    setForm({
      year: String(r.year),
      winner: known(r.winner_person_id, r.names),
      winnerPartner: known(r.winner_partner_id, r.names),
      runnerUp: known(r.runner_up_person_id, r.names),
      runnerUpPartner: known(r.runner_up_partner_id, r.names),
    });
  }

  async function save() {
    if (!form) return;
    setError(null);
    const year = Number(form.year);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) {
      setError("Enter the year, e.g. 2019.");
      return;
    }
    if (!form.winner) {
      setError("Choose the winner.");
      return;
    }
    if (doubles && !form.winnerPartner) {
      setError("Choose the winner's partner.");
      return;
    }
    setBusy(true);
    try {
      await savePastWinner(seriesId, {
        year,
        winner_person_id: form.winner.id,
        winner_partner_id: doubles ? (form.winnerPartner?.id ?? null) : null,
        runner_up_person_id: form.runnerUp?.id ?? null,
        runner_up_partner_id: doubles ? (form.runnerUpPartner?.id ?? null) : null,
      });
      setMessage(`${year} saved.`);
      setForm(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const picker = (key: keyof Omit<Form, "year">, label: string) => (
    <PersonPicker
      id={`past-${key}`}
      label={label}
      value={form?.[key] ?? null}
      onChange={(p) => form && setForm({ ...form, [key]: p })}
      clubs={clubs}
      onClubAdded={(club) => setClubs((list) => [...list, club])}
    />
  );

  return (
    <section>
      <p className="hint">
        Winners from before the site, for the {seriesName} honours board. Years played here fill themselves in. Each
        name opens that player&rsquo;s page - someone not on the site yet can be added as you go.
      </p>
      {message && !error && <p className="hint">{message}</p>}
      {error && !form && <p className="error">{error}</p>}

      {form ? (
        <div className="card venue-admin-editing">
          <div className="field">
            <label htmlFor="past-year">Year</label>
            <input
              id="past-year"
              type="number"
              inputMode="numeric"
              placeholder="2019"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </div>
          {picker("winner", doubles ? "Winner" : "Winner")}
          {doubles && picker("winnerPartner", "Winner's partner")}
          {picker("runnerUp", "Runner-up (optional)")}
          {doubles && form.runnerUp && picker("runnerUpPartner", "Runner-up's partner")}
          {error && <p className="error">{error}</p>}
          <div className="person-check-actions">
            <button type="button" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Save this year"}
            </button>
            <button type="button" className="link-button" onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              setForm(EMPTY);
            }}
          >
            + Add a past year
          </button>
        </p>
      )}

      <div className="venue-cards">
        {rows === null && <p className="quiet-line">Loading&hellip;</p>}
        {rows?.length === 0 && <p className="quiet-line">No past years added yet.</p>}
        {rows?.map((r) => (
          <div key={r.id} className="card venue-admin-card">
            <span className="comp-list-main">
              <strong>
                {r.year} &middot; {r.winner}
              </strong>
              <span className="hint">{r.runnerUp ? `Runner-up ${r.runnerUp}` : "No runner-up added"}</span>
            </span>
            <span className="entries-actions">
              <button type="button" className="link-button" onClick={() => change(r)}>
                Change
              </button>
              <button
                type="button"
                className="link-button comp-form-remove"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Remove ${r.year} from the honours board?`)) return;
                  try {
                    await deletePastWinner(r.id);
                    setMessage(`${r.year} removed.`);
                    await load();
                  } catch (err) {
                    setError(errorMessage(err));
                  }
                }}
              >
                Remove
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
