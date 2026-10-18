"use client";

import { useEffect, useMemo, useState } from "react";
import PersonPicker from "@/components/PersonPicker";
import { errorMessage } from "@/lib/errors";
import {
  distinguishedNames,
  entryCapacity,
  entryName,
  entryProblem,
  type PersonDetails,
} from "@/lib/people";
import {
  addEntry,
  changeEntryPeople,
  deleteEntry,
  listClubs,
  listEntries,
  setEntryStatus,
  type EntryWithPeople,
} from "@/lib/peopleApi";
import type { Competition, Organiser } from "@/lib/types";

// Who's entered in one competition: add a player (or a pair for doubles) with
// the name search, change someone picked wrongly, withdraw or reinstate.
export default function EntriesManager({ competition }: { competition: Competition }) {
  const pairs = competition.team_size === 2;
  const [entries, setEntries] = useState<EntryWithPeople[] | null>(null);
  const [clubs, setClubs] = useState<Organiser[]>([]);
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [partner, setPartner] = useState<PersonDetails | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // entry id
  const [editPerson, setEditPerson] = useState<PersonDetails | null>(null);
  const [editPartner, setEditPartner] = useState<PersonDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      setEntries(await listEntries(competition.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load();
    listClubs()
      .then(setClubs)
      .catch((err) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition.id]);

  const entered = (entries ?? []).filter((e) => e.status === "entered");
  const withdrawn = (entries ?? []).filter((e) => e.status === "withdrawn");
  const capacity = entryCapacity(competition);

  // Names on this list, with a club or note added only where two share a name
  const shown = useMemo(
    () => distinguishedNames((entries ?? []).flatMap((e) => (e.partner ? [e.person, e.partner] : [e.person]))),
    [entries]
  );
  const nameOf = (e: EntryWithPeople) =>
    entryName(shown.get(e.person.id) ?? e.person.full_name, e.partner ? (shown.get(e.partner.id) ?? e.partner.full_name) : null);

  // Already in an entry (other than the one being changed) can't be picked again
  function unavailableExcept(entryId: string | null): Map<string, string> {
    const taken = new Map<string, string>();
    for (const e of entered) {
      if (e.id === entryId) continue;
      taken.set(e.person.id, "Already entered");
      if (e.partner) taken.set(e.partner.id, "Already entered");
    }
    return taken;
  }

  function addClub(club: Organiser) {
    setClubs((current) => [...current, club].sort((a, b) => a.short_name.localeCompare(b.short_name)));
  }

  async function run(action: () => Promise<void>, done: string) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await action();
      setMessage(done);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const problem = entryProblem(competition.team_size, person?.id ?? null, partner?.id ?? null);
    if (problem) {
      setError(problem);
      return;
    }
    const name = entryName(person!.full_name, partner?.full_name);
    await run(async () => {
      await addEntry(competition.id, person!.id, pairs ? partner!.id : null);
      setPerson(null);
      setPartner(null);
    }, `${name} entered.`);
  }

  function startEdit(e: EntryWithPeople) {
    setEditing(e.id);
    setEditPerson(e.person);
    setEditPartner(e.partner);
    setError(null);
    setMessage(null);
  }

  async function saveEdit(e: EntryWithPeople) {
    const problem = entryProblem(competition.team_size, editPerson?.id ?? null, editPartner?.id ?? null);
    if (problem) {
      setError(problem);
      return;
    }
    await run(async () => {
      await changeEntryPeople(e, editPerson!.id, pairs ? editPartner!.id : null);
      setEditing(null);
    }, "Entry changed.");
  }

  const noun = pairs ? "pairs" : "players";

  return (
    <section className="entries">
      <div className="comp-list-head">
        <h2>Entries</h2>
        <span className="hint entries-count">
          {entered.length}
          {capacity ? ` of ${capacity}` : ""} {noun} entered
        </span>
      </div>

      <form className="card entries-add" onSubmit={handleAdd}>
        <h3>{pairs ? "Enter a pair" : "Enter a player"}</h3>
        <PersonPicker
          id="entry-person"
          label={pairs ? "First player" : "Player"}
          value={person}
          onChange={setPerson}
          unavailable={unavailableExcept(null)}
          clubs={clubs}
          onClubAdded={addClub}
        />
        {pairs && (
          <PersonPicker
            id="entry-partner"
            label="Partner"
            value={partner}
            onChange={setPartner}
            unavailable={(() => {
              const taken = unavailableExcept(null);
              if (person) taken.set(person.id, "Already in this pair");
              return taken;
            })()}
            clubs={clubs}
            onClubAdded={addClub}
          />
        )}
        <button type="submit" disabled={busy || !person || (pairs && !partner)}>
          {pairs ? "Enter this pair" : "Enter this player"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && !error && <p className="hint">{message}</p>}

      <div className="card comp-list">
        {entries === null && <p className="hint">Loading&hellip;</p>}
        {entries !== null && entered.length === 0 && <p className="hint">Nobody entered yet.</p>}
        {entered.map((e, i) =>
          editing === e.id ? (
            <div key={e.id} className="entries-edit">
              <p className="hint">
                Change who this entry is. Anything already played moves with it.
              </p>
              <PersonPicker
                id={`edit-person-${e.id}`}
                label={pairs ? "First player" : "Player"}
                value={editPerson}
                onChange={setEditPerson}
                unavailable={unavailableExcept(e.id)}
                clubs={clubs}
                onClubAdded={addClub}
              />
              {pairs && (
                <PersonPicker
                  id={`edit-partner-${e.id}`}
                  label="Partner"
                  value={editPartner}
                  onChange={setEditPartner}
                  unavailable={(() => {
                    const taken = unavailableExcept(e.id);
                    if (editPerson) taken.set(editPerson.id, "Already in this pair");
                    return taken;
                  })()}
                  clubs={clubs}
                  onClubAdded={addClub}
                />
              )}
              <div className="person-check-actions">
                <button type="button" disabled={busy} onClick={() => saveEdit(e)}>
                  Save
                </button>
                <button type="button" className="link-button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={e.id} className="comp-list-row">
              <span className="entries-number">{i + 1}</span>
              <span className="comp-list-main">
                <strong>{nameOf(e)}</strong>
                <span className="hint">
                  {[e.person.club_name, e.partner?.club_name].filter(Boolean).join(" & ") || "Club not known"}
                </span>
              </span>
              <span className="entries-actions">
                <button type="button" className="link-button" disabled={busy} onClick={() => startEdit(e)}>
                  Change
                </button>
                <button
                  type="button"
                  className="link-button comp-form-remove"
                  disabled={busy}
                  onClick={() => run(() => setEntryStatus(e, "withdrawn"), `${nameOf(e)} withdrawn.`)}
                >
                  Withdraw
                </button>
              </span>
            </div>
          )
        )}
      </div>

      {withdrawn.length > 0 && (
        <>
          <h3>Withdrawn</h3>
          <div className="card comp-list entries-withdrawn">
            {withdrawn.map((e) => (
              <div key={e.id} className="comp-list-row">
                <span className="comp-list-main">
                  <strong>{nameOf(e)}</strong>
                </span>
                <span className="entries-actions">
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() => run(() => setEntryStatus(e, "entered"), `${nameOf(e)} back in.`)}
                  >
                    Reinstate
                  </button>
                  <button
                    type="button"
                    className="link-button comp-form-remove"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remove ${nameOf(e)} completely? Only for an entry made by mistake.`)) {
                        run(() => deleteEntry(e), `${nameOf(e)} removed.`);
                      }
                    }}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
