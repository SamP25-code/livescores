"use client";

import { useEffect, useRef, useState } from "react";
import { useIsSuper } from "@/lib/auth";
import { createOrganiser } from "@/lib/competitionsApi";
import { errorMessage } from "@/lib/errors";
import { newPersonProblem, personDetailsLine, tidyName, type PersonDetails } from "@/lib/people";
import { createPerson, findSameName, searchPeople } from "@/lib/peopleApi";
import type { Organiser } from "@/lib/types";

type Step =
  | { kind: "search" }
  | { kind: "same-name"; matches: PersonDetails[] } // "Is this them?"
  | { kind: "new"; sameName: PersonDetails[] }; // a new person's club / note

// Picks one person by typing their name. Everyone already in the app who
// matches is listed to tap; a new person is only created if they aren't
// there - and if the exact name is already taken, it asks whether it's the
// same person first.
export default function PersonPicker({
  id,
  label,
  value,
  onChange,
  unavailable,
  clubs,
  onClubAdded,
  allowNew = true,
}: {
  id: string;
  label: string;
  value: PersonDetails | null;
  onChange: (person: PersonDetails | null) => void;
  // People who can't be picked here, and why ("Already entered")
  unavailable?: Map<string, string>;
  clubs: Organiser[];
  onClubAdded?: (club: Organiser) => void;
  // false: only people already in the app (e.g. choosing who to merge)
  allowNew?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonDetails[]>([]);
  const [searching, setSearching] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [clubId, setClubId] = useState("");
  const [newClub, setNewClub] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef("");
  // Adding a club is part of the set-up, so Super only
  const canAddClub = Boolean(useIsSuper());

  // Search as they type, a moment after they stop
  useEffect(() => {
    latest.current = query;
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchPeople(query);
        if (latest.current === query) setResults(found);
      } catch (err) {
        if (latest.current === query) setError(errorMessage(err));
      } finally {
        if (latest.current === query) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function reset() {
    setQuery("");
    setResults([]);
    setStep({ kind: "search" });
    setClubId("");
    setNewClub("");
    setNote("");
    setError(null);
  }

  function pick(p: PersonDetails) {
    reset();
    onChange(p);
  }

  async function startNew() {
    setError(null);
    setBusy(true);
    try {
      const matches = await findSameName(query);
      setStep(matches.length > 0 ? { kind: "same-name", matches } : { kind: "new", sameName: [] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveNew() {
    if (step.kind !== "new") return;
    setError(null);
    const chosenClub = clubId === "new" ? null : clubId || null;
    if (clubId === "new" && !newClub.trim()) {
      setError("Enter the new club's name.");
      return;
    }
    // A brand-new club can't match anyone's existing club, so it counts as different
    const problem = newPersonProblem(query, clubId === "new" ? "new-club" : chosenClub, note, step.sameName);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      let club_id = chosenClub;
      if (clubId === "new") {
        const club = await createOrganiser({ name: newClub.trim(), short_name: newClub.trim(), kind: "club" });
        onClubAdded?.(club);
        club_id = club.id;
      }
      pick(await createPerson({ full_name: query, club_id, note: note.trim() || null }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="field">
        <span className="person-picker-label">{label}</span>
        <div className="person-picked">
          <span className="person-picked-main">
            <strong>{value.full_name}</strong>
            <span className="hint">{personDetailsLine(value)}</span>
          </span>
          <button type="button" className="link-button" onClick={() => onChange(null)}>
            Change
          </button>
        </div>
      </div>
    );
  }

  const typed = tidyName(query);

  return (
    <div className="field person-picker">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        placeholder="Start typing a name"
        value={query}
        disabled={step.kind !== "search"}
        onChange={(e) => {
          setQuery(e.target.value);
          setError(null);
        }}
      />

      {step.kind === "search" && query.trim().length >= 2 && (
        <div className="person-results" aria-live="polite">
          {results.map((p) => {
            const reason = unavailable?.get(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className="person-result"
                disabled={!!reason}
                onClick={() => pick(p)}
              >
                <strong>{p.full_name}</strong>
                <span className="hint">{reason ?? personDetailsLine(p)}</span>
              </button>
            );
          })}
          {!searching && results.length === 0 && <p className="hint person-results-none">Nobody called that yet.</p>}
          {allowNew && (
            <button type="button" className="person-result person-result-new" disabled={busy || !typed} onClick={startNew}>
              + Add &ldquo;{typed}&rdquo; as a new person
            </button>
          )}
        </div>
      )}

      {step.kind === "same-name" && (
        <div className="comp-form-sub person-check">
          <p>
            <strong>
              {step.matches.length === 1
                ? `There's already a ${typed} - is this them?`
                : `There are already ${step.matches.length} people called ${typed} - is it one of them?`}
            </strong>
          </p>
          {step.matches.map((p) => {
            const reason = unavailable?.get(p.id);
            return (
              <div key={p.id} className="person-check-row">
                <span className="person-picked-main">
                  <strong>{p.full_name}</strong>
                  <span className="hint">{reason ?? personDetailsLine(p)}</span>
                </span>
                <button type="button" className="secondary" disabled={!!reason} onClick={() => pick(p)}>
                  Yes, use them
                </button>
              </div>
            );
          })}
          <div className="person-check-actions">
            <button type="button" className="secondary" onClick={() => setStep({ kind: "new", sameName: step.matches })}>
              No, a different person
            </button>
            <button type="button" className="link-button" onClick={() => setStep({ kind: "search" })}>
              Back
            </button>
          </div>
        </div>
      )}

      {step.kind === "new" && (
        <div className="comp-form-sub person-check">
          <p>
            <strong>New person: {typed}</strong>
            {step.sameName.length > 0 && (
              <>
                <br />
                <span className="hint">
                  Add their club, or a short note if they&rsquo;re at the same club (Snr, Jnr, a middle initial) - it
                  shows in the search from now on.
                </span>
              </>
            )}
          </p>
          <div className="field">
            <label htmlFor={`${id}-club`}>Club{step.sameName.length > 0 ? "" : " (optional)"}</label>
            <select id={`${id}-club`} value={clubId} onChange={(e) => setClubId(e.target.value)}>
              <option value="">Not known</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.short_name}
                </option>
              ))}
              {canAddClub && <option value="new">+ A club not listed</option>}
            </select>
          </div>
          {clubId === "new" && (
            <div className="field">
              <label htmlFor={`${id}-new-club`}>Club name</label>
              <input id={`${id}-new-club`} value={newClub} onChange={(e) => setNewClub(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor={`${id}-note`}>Note (optional)</label>
            <input id={`${id}-note`} placeholder="e.g. Snr" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="person-check-actions">
            <button type="button" disabled={busy} onClick={saveNew}>
              {busy ? "Adding…" : "Add person"}
            </button>
            <button type="button" className="link-button" onClick={() => setStep({ kind: "search" })}>
              Back
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
