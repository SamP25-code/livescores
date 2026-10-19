"use client";

import { useEffect, useState } from "react";
import { useIsSuper } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { personDetailsLine, type PersonDetails } from "@/lib/people";
import { isPersonHidden, listClubs, mergePeople, setPersonHidden, updatePerson } from "@/lib/peopleApi";
import PersonPicker from "@/components/PersonPicker";
import type { Organiser } from "@/lib/types";
import { SITE_NAME } from "@/lib/site";

// Fixing mistakes in the shared list of people. Super only: correct a name,
// club or note, or merge two records that turn out to be the same person.
// (Someone picked wrongly for one entry is fixed on that competition's
// entries instead - "Change".)
export default function PeoplePage() {
  const isSuper = useIsSuper();
  const [clubs, setClubs] = useState<Organiser[]>([]);
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [form, setForm] = useState({ full_name: "", club_id: "", note: "" });
  const [other, setOther] = useState<PersonDetails | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = `People · Admin · ${SITE_NAME}`;
  }, []);

  useEffect(() => {
    if (!isSuper) return;
    listClubs()
      .then(setClubs)
      .catch((err) => setError(errorMessage(err)));
  }, [isSuper]);

  function choose(p: PersonDetails | null) {
    setPerson(p);
    setOther(null);
    setError(null);
    if (p) {
      setMessage(null);
      isPersonHidden(p.id)
        .then(setHidden)
        .catch(() => setHidden(false));
      setForm({ full_name: p.full_name, club_id: p.club_id ?? "", note: p.note ?? "" });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    if (!form.full_name.trim()) {
      setError("Enter their full name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePerson(person.id, { full_name: form.full_name, club_id: form.club_id || null, note: form.note });
      setMessage(`${form.full_name.trim()} saved.`);
      setPerson(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function merge() {
    if (!person || !other) return;
    const question =
      `Merge "${other.full_name}" (${personDetailsLine(other)}) into "${person.full_name}"?\n\n` +
      `Every entry and result moves to ${person.full_name}. This is logged.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      await mergePeople(other.id, person.id);
      setMessage(`${other.full_name} merged into ${person.full_name}.`);
      setPerson(null);
      setOther(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isSuper === false) {
    return (
      <div className="page page-photo">
        <h1>People</h1>
        <p className="hint">Only Sam (Super) can change people.</p>
      </div>
    );
  }

  return (
    <div className="page page-photo">
      <h1>People</h1>
      <p className="hint people-intro">
        Everyone who has played, shared by every competition. Find someone to correct their name, club or note, or to
        merge a duplicate record into them.
      </p>

      <div className="card">
        <PersonPicker
          id="people-find"
          label="Find a person"
          value={person}
          onChange={choose}
          clubs={clubs}
          allowNew={false}
        />
      </div>

      {message && !error && <p className="hint">{message}</p>}
      {error && <p className="error">{error}</p>}

      {person && (
        <>
          <form className="card" onSubmit={save}>
            <h2>Details</h2>
            <div className="field">
              <label htmlFor="people-name">Full name</label>
              <input
                id="people-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="comp-form-grid">
              <div className="field">
                <label htmlFor="people-club">Club</label>
                <select id="people-club" value={form.club_id} onChange={(e) => setForm({ ...form, club_id: e.target.value })}>
                  <option value="">Not known</option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="people-note">Note</label>
                <input
                  id="people-note"
                  placeholder="e.g. Snr"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </form>

          <div className="card">
            <h2>Privacy</h2>
            {hidden ? (
              <p className="hint">
                <strong>{person.full_name}</strong>&rsquo;s name is hidden - every page shows &ldquo;Withdrawn
                player&rdquo; instead. Their results are kept.
              </p>
            ) : (
              <p className="hint">
                If {person.full_name} asks for their name to be taken off the site, every page will show
                &ldquo;Withdrawn player&rdquo; instead. Their results stay, so draws still make sense.
              </p>
            )}
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={async () => {
                const next = !hidden;
                if (next && !confirm(`Hide ${person.full_name}'s name on every page?`)) return;
                setBusy(true);
                setError(null);
                try {
                  await setPersonHidden(person.id, next);
                  setHidden(next);
                  setMessage(next ? `${person.full_name}'s name is now hidden.` : `${person.full_name}'s name is shown again.`);
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {hidden ? "Show their name again" : "Hide their name"}
            </button>
          </div>

          <div className="card">
            <h2>Merge a duplicate</h2>
            <p className="hint">
              If someone is in the list twice (e.g. &ldquo;W Ditchfield&rdquo; and &ldquo;Wayne Ditchfield&rdquo;),
              find the other record here. It&rsquo;s merged into <strong>{person.full_name}</strong>.
            </p>
            <PersonPicker
              id="people-other"
              label="The other record"
              value={other}
              onChange={setOther}
              unavailable={new Map([[person.id, "This is the person above"]])}
              clubs={clubs}
              allowNew={false}
            />
            <button type="button" className="secondary" disabled={busy || !other} onClick={merge}>
              Merge into {person.full_name}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
