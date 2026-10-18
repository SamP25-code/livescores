"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { distinguishedNames, entryName, matchesSearch } from "@/lib/people";
import type { EntryWithPeople } from "@/lib/peopleApi";

// Adds a competition's entries to one session's draw. Lists everyone entered
// who isn't in a draw yet - tap to add one, or add them all at once (the
// 32 pairs on the day). New people are entered on the competition's page.
export default function SessionEntryAdder({
  competitionId,
  pairs,
  entries,
  problemFor,
  onAdd,
}: {
  competitionId: string;
  pairs: boolean;
  entries: EntryWithPeople[];
  // Why an entry can't go in this draw ("Already in this draw"), or null
  problemFor: (entryId: string) => string | null;
  onAdd: (entryIds: string[]) => Promise<void>;
}) {
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const entered = entries.filter((e) => e.status === "entered");
  const shown = useMemo(
    () => distinguishedNames(entries.flatMap((e) => (e.partner ? [e.person, e.partner] : [e.person]))),
    [entries]
  );
  const nameOf = (e: EntryWithPeople) =>
    entryName(shown.get(e.person.id) ?? e.person.full_name, e.partner ? (shown.get(e.partner.id) ?? e.partner.full_name) : null);

  const available = entered.filter((e) => !problemFor(e.id));
  const listed = entered.filter(
    (e) =>
      !filter.trim() ||
      matchesSearch(e.person.full_name, filter) ||
      (e.partner != null && matchesSearch(e.partner.full_name, filter))
  );

  async function add(ids: string[]) {
    setBusy(true);
    try {
      await onAdd(ids);
    } finally {
      setBusy(false);
    }
  }

  const noun = pairs ? "pair" : "player";

  return (
    <div className="card session-adder">
      <div className="session-adder-head">
        <strong>
          {available.length} {noun}
          {available.length === 1 ? "" : "s"} entered and not in a draw yet
        </strong>
        {available.length > 1 && (
          <button type="button" disabled={busy} onClick={() => add(available.map((e) => e.id))}>
            Add all {available.length}
          </button>
        )}
      </div>
      {entered.length === 0 ? (
        <p className="hint">
          Nobody entered yet. <Link href={`/admin/competitions/${competitionId}`}>Enter {noun}s</Link> on the
          competition&rsquo;s page first.
        </p>
      ) : (
        <>
          {entered.length > 8 && (
            <input
              type="search"
              aria-label="Find an entry"
              placeholder="Find a name"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}
          <div className="session-adder-list">
            {listed.map((e) => {
              const problem = problemFor(e.id);
              return (
                <div key={e.id} className={`session-adder-row ${problem ? "session-adder-row-placed" : ""}`}>
                  <span className="comp-list-main">
                    <strong>{nameOf(e)}</strong>
                    {problem && <span className="hint">{problem}</span>}
                  </span>
                  {!problem && (
                    <button type="button" className="secondary" disabled={busy} onClick={() => add([e.id])}>
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="hint session-adder-foot">
            Someone missing? <Link href={`/admin/competitions/${competitionId}`}>Enter them</Link> on the
            competition&rsquo;s page, then add them here.
          </p>
        </>
      )}
    </div>
  );
}
