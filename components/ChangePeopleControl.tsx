"use client";

import { useState } from "react";
import PersonPicker from "@/components/PersonPicker";
import { entryProblem, type PersonDetails } from "@/lib/people";
import type { EntryWithPeople } from "@/lib/peopleApi";
import type { Organiser } from "@/lib/types";

type Side = "a" | "b";

// On a match that hasn't finished: someone didn't turn up (their opponent
// goes through, undoable), or someone else takes their place - same draw
// number, same opponent. For a pair, change just the one who can't play.
export default function ChangePeopleControl({
  nameA,
  nameB,
  entryA,
  entryB,
  pairs,
  clubs,
  canNoShow,
  onNoShow,
  onReplace,
}: {
  nameA: string;
  nameB: string;
  // The entries in the match - only 2027 competitions have them
  entryA?: EntryWithPeople;
  entryB?: EntryWithPeople;
  pairs: boolean;
  clubs: Organiser[];
  canNoShow: boolean;
  onNoShow: (side: Side) => Promise<void>;
  onReplace: (side: Side, personId: string, partnerId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [replacing, setReplacing] = useState<Side | null>(null);
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [partner, setPartner] = useState<PersonDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canReplace = Boolean(entryA || entryB);
  if (!canNoShow && !canReplace) return null;

  function close() {
    setOpen(false);
    setReplacing(null);
    setError(null);
  }

  function startReplace(side: Side) {
    const entry = side === "a" ? entryA : entryB;
    setReplacing(side);
    setPerson(entry?.person ?? null);
    setPartner(entry?.partner ?? null);
    setError(null);
  }

  async function saveReplace() {
    if (!replacing) return;
    const problem = entryProblem(pairs ? 2 : 1, person?.id ?? null, partner?.id ?? null);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onReplace(replacing, person!.id, pairs ? partner!.id : null);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make that change.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <p style={{ marginTop: 8 }}>
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          Someone not here?
        </button>
      </p>
    );
  }

  if (replacing) {
    const name = replacing === "a" ? nameA : nameB;
    return (
      <div className="comp-form-sub change-people">
        <p>
          <strong>Replace {name}</strong>
          <br />
          <span className="hint">
            {pairs
              ? "Change whichever player isn't here. The new pair takes this place in the draw."
              : "The replacement takes this place in the draw - same number, same opponent."}
          </span>
        </p>
        <PersonPicker
          id={`replace-person-${replacing}`}
          label={pairs ? "First player" : "Replacement"}
          value={person}
          onChange={setPerson}
          clubs={clubs}
        />
        {pairs && (
          <PersonPicker
            id={`replace-partner-${replacing}`}
            label="Partner"
            value={partner}
            onChange={setPartner}
            unavailable={person ? new Map([[person.id, "Already in this pair"]]) : undefined}
            clubs={clubs}
          />
        )}
        {error && <p className="error">{error}</p>}
        <div className="person-check-actions">
          <button type="button" disabled={busy} onClick={saveReplace}>
            {busy ? "Saving…" : "Replace"}
          </button>
          <button type="button" className="link-button" onClick={() => setReplacing(null)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  function confirmNoShow(side: Side) {
    const absent = side === "a" ? nameA : nameB;
    const through = side === "a" ? nameB : nameA;
    if (confirm(`${absent} didn't turn up - put ${through} through? You can undo this if they arrive.`)) {
      onNoShow(side);
      close();
    }
  }

  return (
    <div className="change-people-options">
      {canNoShow && (
        <>
          <button type="button" className="secondary" onClick={() => confirmNoShow("a")}>
            {nameA} didn&rsquo;t turn up
          </button>
          <button type="button" className="secondary" onClick={() => confirmNoShow("b")}>
            {nameB} didn&rsquo;t turn up
          </button>
        </>
      )}
      {entryA && (
        <button type="button" className="secondary" onClick={() => startReplace("a")}>
          Replace {nameA}
        </button>
      )}
      {entryB && (
        <button type="button" className="secondary" onClick={() => startReplace("b")}>
          Replace {nameB}
        </button>
      )}
      <button type="button" className="link-button" onClick={close}>
        Cancel
      </button>
    </div>
  );
}
