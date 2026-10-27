"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PersonPicker from "@/components/PersonPicker";
import PersonDetailsEditor from "@/components/PersonDetailsEditor";
import { syncSessionPlaces } from "@/lib/adminActions";
import { longDate } from "@/lib/competitionSetup";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabaseClient";
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
  moveEntry,
  setEntryStatus,
  type EntryWithPeople,
} from "@/lib/peopleApi";
import { defaultSession, fullProblem } from "@/lib/sessionEntries";
import type { Competition, Night, Organiser } from "@/lib/types";

// Who's entered in one competition: add a player (or a pair for doubles) with
// the name search, change someone picked wrongly, withdraw or reinstate.
// Everyone entered is in the draw - there's no separate step to add them:
// for a single day, the day's draw; for qualifying sessions, the session
// they're entered for (picked here, defaulting to the first with space).
export default function EntriesManager({ competition, sessions }: { competition: Competition; sessions: Night[] }) {
  const pairs = competition.team_size === 2;
  const qualifying = competition.format === "qualifying_and_finals";
  const qualifyingSessions = sessions
    .filter((s) => s.kind === "qualifier")
    .sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0));
  const drawSessions = sessions.filter((s) => s.kind !== "finals");

  const [entries, setEntries] = useState<EntryWithPeople[] | null>(null);
  const [clubs, setClubs] = useState<Organiser[]>([]);
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [partner, setPartner] = useState<PersonDetails | null>(null);
  const [sessionChoice, setSessionChoice] = useState(""); // "" = the default
  const [editing, setEditing] = useState<string | null>(null); // entry id
  const [editPerson, setEditPerson] = useState<PersonDetails | null>(null);
  const [editPartner, setEditPartner] = useState<PersonDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Sessions whose draw has been made
  const [drawMade, setDrawMade] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const ids = drawSessions.map((s) => s.id);
      const [list, made] = await Promise.all([
        listEntries(competition.id),
        ids.length
          ? supabase.from("matches").select("night_id").in("night_id", ids).eq("round", 1)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (made.error) throw made.error;
      setEntries(list);
      setDrawMade(new Set((made.data ?? []).map((m: { night_id: string }) => m.night_id)));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // In a draw that's been made: they can only be withdrawn (or replaced in
  // the draw). Otherwise an entry can simply be removed.
  function inMadeDraw(e: EntryWithPeople): boolean {
    return qualifying ? Boolean(e.session_id && drawMade.has(e.session_id)) : drawSessions.some((s) => drawMade.has(s.id));
  }

  function confirmRemove(e: EntryWithPeople) {
    if (window.confirm(`Remove ${nameOf(e)}?`)) {
      run(() => deleteEntry(e), `${nameOf(e)} removed.`, drawsFor(e.session_id));
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
  const suggested = defaultSession(qualifyingSessions, entries ?? [], competition.entries_per_night);
  const chosenSession = sessionChoice || suggested?.id || "";

  // A full session (or a full one-day draw) takes no more: 16 of 16 stays 16
  const inSession = (id: string | null) => entered.filter((e) => e.session_id === id).length;
  function roomProblem(sessionId: string | null, leaving?: EntryWithPeople): string | null {
    if (qualifying && sessionId) {
      const s = qualifyingSessions.find((x) => x.id === sessionId);
      return fullProblem({
        limit: competition.entries_per_night,
        count: inSession(sessionId) - (leaving && leaving.session_id === sessionId ? 1 : 0),
        where: s ? `Session ${s.session_number}` : "That session",
      });
    }
    if (!qualifying) return fullProblem({ limit: capacity, count: entered.length - (leaving ? 1 : 0), where: "The draw" });
    return null;
  }

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

  // The draws an entry's change affects: its session (and the one it came
  // from, when moving), or the one draw of a single day
  function drawsFor(...sessionIds: (string | null | undefined)[]): string[] {
    if (!qualifying) return drawSessions.map((s) => s.id);
    return [...new Set(sessionIds.filter((id): id is string => Boolean(id)))];
  }

  async function run(action: () => Promise<void>, done: string, draws: string[]) {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await action();
      // Keeps those draws in step (only until each draw is made)
      for (const id of draws) await syncSessionPlaces(id);
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
    const sessionId = qualifying ? chosenSession || null : null;
    const full = roomProblem(sessionId);
    if (full) {
      setError(qualifying ? `${full} Choose another session.` : `${full} Withdraw someone to make room.`);
      return;
    }
    await run(
      async () => {
        await addEntry(competition.id, person!.id, pairs ? partner!.id : null, sessionId);
        setPerson(null);
        setPartner(null);
        setSessionChoice("");
      },
      `${name} entered.`,
      drawsFor(sessionId)
    );
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
    await run(
      async () => {
        await changeEntryPeople(e, editPerson!.id, pairs ? editPartner!.id : null);
        setEditing(null);
      },
      "Entry changed.",
      []
    );
  }

  const noun = pairs ? "pairs" : "players";

  function sessionLabel(s: Night): string {
    return `Session ${s.session_number}${s.date ? ` · ${longDate(s.date)}` : ""}`;
  }

  function entryRow(e: EntryWithPeople, i: number) {
    if (editing === e.id) {
      return (
        <div key={e.id} className="entries-edit">
          <p className="hint">
            Picked the wrong person? Change who this entry is - anything already played moves with it. Right person,
            wrong spelling? Correct their details instead.
          </p>
          <div className="person-details-list">
            {[e.person, e.partner].filter((p): p is PersonDetails => Boolean(p)).map((p) => (
              <PersonDetailsEditor key={p.id} person={p} clubs={clubs} onSaved={load} />
            ))}
          </div>
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
      );
    }
    return (
      <div key={e.id} className="comp-list-row">
        <span className="entries-number">{i + 1}</span>
        <span className="comp-list-main">
          <strong>{nameOf(e)}</strong>
          <span className="hint">
            {[e.person.club_name, e.partner?.club_name].filter(Boolean).join(" & ") || "Club not known"}
          </span>
        </span>
        <span className="entries-actions">
          {qualifying && qualifyingSessions.length > 1 && (
            <select
              aria-label={`Session for ${nameOf(e)}`}
              className="entries-move"
              value={e.session_id ?? ""}
              disabled={busy}
              onChange={(ev) => {
                const full = roomProblem(ev.target.value);
                if (full) {
                  setError(`${full} ${nameOf(e)} stays where they are.`);
                  return;
                }
                run(() => moveEntry(e, ev.target.value), `${nameOf(e)} moved.`, drawsFor(e.session_id, ev.target.value));
              }}
            >
              {!e.session_id && <option value="">No session</option>}
              {qualifyingSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  Session {s.session_number}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="link-button" disabled={busy} onClick={() => startEdit(e)}>
            Change
          </button>
          {inMadeDraw(e) ? (
            <button
              type="button"
              className="link-button comp-form-remove"
              disabled={busy}
              onClick={() => run(() => setEntryStatus(e, "withdrawn"), `${nameOf(e)} withdrawn.`, drawsFor(e.session_id))}
            >
              Withdraw
            </button>
          ) : (
            <button type="button" className="link-button comp-form-remove" disabled={busy} onClick={() => confirmRemove(e)}>
              Remove
            </button>
          )}
        </span>
      </div>
    );
  }

  // Qualifying: one group per session. Otherwise one list.
  const groups: { key: string; title: string | null; session: Night | null; list: EntryWithPeople[] }[] = qualifying
    ? [
        ...qualifyingSessions.map((s) => ({
          key: s.id,
          title: sessionLabel(s),
          session: s,
          list: entered.filter((e) => e.session_id === s.id),
        })),
        {
          key: "none",
          title: "No session yet",
          session: null,
          list: entered.filter((e) => !qualifyingSessions.some((s) => s.id === e.session_id)),
        },
      ].filter((g) => g.session || g.list.length > 0)
    : [{ key: "all", title: null, session: drawSessions[0] ?? null, list: entered }];

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
        {qualifying && qualifyingSessions.length > 0 && (
          <div className="field">
            <label htmlFor="entry-session">Plays in</label>
            <select id="entry-session" value={chosenSession} onChange={(e) => setSessionChoice(e.target.value)}>
              {qualifyingSessions.map((s) => {
                const count = entered.filter((e) => e.session_id === s.id).length;
                const full = Boolean(competition.entries_per_night && count >= competition.entries_per_night);
                return (
                  <option key={s.id} value={s.id} disabled={full}>
                    {sessionLabel(s)} ({count}
                    {competition.entries_per_night ? ` of ${competition.entries_per_night}` : ""}
                    {full ? " - full" : ""})
                  </option>
                );
              })}
            </select>
          </div>
        )}
        <button type="submit" disabled={busy || !person || (pairs && !partner)}>
          {pairs ? "Enter this pair" : "Enter this player"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && !error && <p className="hint">{message}</p>}

      {entries === null && <p className="quiet-line">Loading&hellip;</p>}
      {entries !== null &&
        groups.map((g) => (
          <div key={g.key} className="entries-group">
            {(g.title || g.session) && (
              <div className="entries-group-head">
                {g.title && (
                  <h3>
                    {g.title}
                    <span className="hint">
                      {" "}
                      · {g.list.length}
                      {qualifying && competition.entries_per_night ? ` of ${competition.entries_per_night}` : ""}
                    </span>
                  </h3>
                )}
                {g.session && g.list.length > 0 && (
                  <Link href={`/admin/night/${g.session.id}`} className="entries-draw-link">
                    The draw
                  </Link>
                )}
              </div>
            )}
            <div className="card comp-list">
              {g.list.length === 0 ? <p className="hint">Nobody entered yet</p> : g.list.map(entryRow)}
            </div>
          </div>
        ))}

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
                    onClick={() => {
                      const full = roomProblem(e.session_id ?? null);
                      if (full) {
                        setError(`${full} Make room before bringing ${nameOf(e)} back.`);
                        return;
                      }
                      run(() => setEntryStatus(e, "entered"), `${nameOf(e)} back in.`, drawsFor(e.session_id));
                    }}
                  >
                    Reinstate
                  </button>
                  <button
                    type="button"
                    className="link-button comp-form-remove"
                    disabled={busy}
                    onClick={() => confirmRemove(e)}
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
