"use client";

import { useEffect, useState } from "react";
import PersonPicker from "@/components/PersonPicker";
import { listCompetitions, type CompetitionWithSeries } from "@/lib/competitionsApi";
import { errorMessage } from "@/lib/errors";
import type { PersonDetails } from "@/lib/people";
import { listClubs } from "@/lib/peopleApi";
import {
  DEPTH_LABEL,
  STAGE_LABEL,
  matchesInStage,
  placeView,
  resultsProblem,
  stagesFor,
  type Place,
  type QualifierEvent,
  type QualifierMatch,
  type ResultsDepth,
} from "@/lib/qualifying";
import {
  addQualifier,
  addWildcardPlace,
  fillPlaces,
  fillWildcard,
  loadQualifying,
  makeWildcard,
  removePlace,
  saveResults,
  updateQualifier,
  type QualifierInput,
  type QualifyingData,
} from "@/lib/qualifyingApi";
import type { Organiser } from "@/lib/types";

// The Qualifying tab of a competition entered by qualification: its places,
// each filled by a qualifying competition's winner or as a wildcard. Add
// qualifying competitions (on this site, or not - with their results entered
// here), fill and change wildcards. Winners fill their places by themselves.
export default function QualifyingManager({ competitionId }: { competitionId: string }) {
  const [data, setData] = useState<QualifyingData | null>(null);
  const [comps, setComps] = useState<CompetitionWithSeries[]>([]);
  const [clubs, setClubs] = useState<Organiser[]>([]);
  const [open, setOpen] = useState<string | null>(null); // "add", or "results:<place>", "edit:<place>", "fill:<place>"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load(fill = false) {
    try {
      // Picks up champions of competitions on this site since last time
      if (fill) await fillPlaces(competitionId);
      setData(await loadQualifying(competitionId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    load(true);
    listCompetitions()
      .then((all) => setComps(all.filter((c) => c.id !== competitionId)))
      .catch(() => {});
    listClubs()
      .then(setClubs)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setOpen(null);
      setMessage(done);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="hint">{error ?? "Loading…"}</p>;

  const counts = { qualified: 0, wildcards: 0, open: 0 };
  for (const p of data.places) {
    if (p.entry_id) counts[p.source === "wildcard" ? "wildcards" : "qualified"]++;
    else counts.open++;
  }
  const total = data.places.length || 1;
  const nameOfEntry = (p: Place) => {
    const e = p.entry_id ? data.entries.get(p.entry_id) : undefined;
    return e ? (data.names.get(e.person_id) ?? "Qualified") : null;
  };

  return (
    <section className="qualifying">
      <div className="card">
        <strong className="qualifying-total">
          {data.places.length} place{data.places.length === 1 ? "" : "s"}
        </strong>
        <div className="qualifying-meter" aria-hidden="true">
          <i style={{ width: `${(counts.qualified / total) * 100}%`, background: "var(--green-deep)" }} />
          <i style={{ width: `${(counts.wildcards / total) * 100}%`, background: "var(--gold)" }} />
        </div>
        <p className="hint hint-flush">
          {counts.qualified} qualified · {counts.wildcards} wildcard{counts.wildcards === 1 ? "" : "s"} · {counts.open} still
          to be decided
        </p>
      </div>

      {message && !error && <p className="hint">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card comp-list">
        {data.places.length === 0 && <p className="hint">No places yet - add a qualifying competition or a wildcard.</p>}
        {data.places.map((p) => {
          const view = placeView(p);
          const event = p.qualifier_event_id ? data.events.get(p.qualifier_event_id) : undefined;
          const entry = p.entry_id ? data.entries.get(p.entry_id) : undefined;
          const who = nameOfEntry(p);
          const onSite = Boolean(event?.source_competition_id);
          return (
            <div key={p.id} className="qualifying-place">
              <div className="qualifying-place-row">
                <span className={`qualifying-num qualifying-num-${p.source === "wildcard" ? "wild" : who ? "done" : "open"}`}>
                  {p.place_number}
                </span>
                <span className="comp-list-main">
                  <span className="hint">
                    {p.source_label}
                    {p.source === "wildcard" && p.original_source_label ? ` (was: ${p.original_source_label})` : ""}
                  </span>
                  {who ? <strong>{who}</strong> : <em className="hint">{onSite && !p.flagged ? "Played on this site - fills itself" : view.label}</em>}
                  {view.state === "flagged" && <span className="qualifying-flag">Check: {p.flagged}</span>}
                </span>
              </div>
              <div className="entries-actions qualifying-actions">
                {p.source !== "wildcard" && event && !onSite && (
                  <button type="button" className="link-button" onClick={() => setOpen(`results:${p.id}`)}>
                    {who ? "Results" : "Enter results"}
                  </button>
                )}
                {p.source !== "wildcard" && event && (
                  <button type="button" className="link-button" onClick={() => setOpen(`edit:${p.id}`)}>
                    Change
                  </button>
                )}
                {p.source !== "wildcard" && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Make place ${p.place_number} a wildcard? Where it came from is kept on record.`)) {
                        run(() => makeWildcard(p, entry), `Place ${p.place_number} is now a wildcard.`);
                      }
                    }}
                  >
                    Make wildcard
                  </button>
                )}
                {p.source === "wildcard" && (
                  <button type="button" className="link-button" onClick={() => setOpen(`fill:${p.id}`)}>
                    {who ? "Change" : "Fill"}
                  </button>
                )}
                <button
                  type="button"
                  className="link-button comp-form-remove"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Remove place ${p.place_number}${event ? ` (${event.name})` : ""}?`)) {
                      run(() => removePlace(p, entry), `Place ${p.place_number} removed.`);
                    }
                  }}
                >
                  Remove
                </button>
              </div>

              {open === `results:${p.id}` && event && (
                <ResultsEditor
                  event={event}
                  matches={data.matches.get(event.id) ?? []}
                  names={data.names}
                  clubs={clubs}
                  busy={busy}
                  onCancel={() => setOpen(null)}
                  onSave={(matches, winner) => run(() => saveResults(event, matches, winner), `${event.name} results saved.`)}
                />
              )}
              {open === `edit:${p.id}` && event && (
                <QualifierForm
                  initial={event}
                  comps={comps}
                  busy={busy}
                  onCancel={() => setOpen(null)}
                  onSave={(input) => run(() => updateQualifier(event, input), `${input.name} saved.`)}
                />
              )}
              {open === `fill:${p.id}` && (
                <div className="comp-form-sub">
                  <PersonPicker
                    id={`wild-${p.id}`}
                    label={`Wildcard - place ${p.place_number}`}
                    value={null}
                    onChange={(person) => {
                      if (person) run(() => fillWildcard(p, entry, person.id, data), `${person.full_name} has place ${p.place_number}.`);
                    }}
                    clubs={clubs}
                  />
                  <div className="person-check-actions">
                    {who && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => run(() => fillWildcard(p, entry, null, data), `Place ${p.place_number} emptied.`)}
                      >
                        Empty this place
                      </button>
                    )}
                    <button type="button" className="link-button" onClick={() => setOpen(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {open === "add" ? (
        <div className="card">
          <h3>Add a qualifying competition</h3>
          <QualifierForm
            comps={comps}
            busy={busy}
            onCancel={() => setOpen(null)}
            onSave={(input) => run(() => addQualifier(competitionId, input), `${input.name} added.`)}
          />
        </div>
      ) : (
        <div className="person-check-actions">
          <button type="button" onClick={() => setOpen("add")}>
            + Add a qualifying competition
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => run(() => addWildcardPlace(competitionId), "Wildcard place added.")}
          >
            + Add a wildcard place
          </button>
        </div>
      )}
    </section>
  );
}

function QualifierForm({
  initial,
  comps,
  busy,
  onSave,
  onCancel,
}: {
  initial?: QualifierEvent;
  comps: CompetitionWithSeries[];
  busy: boolean;
  onSave: (input: QualifierInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [date, setDate] = useState(initial?.final_date ?? "");
  const [onSite, setOnSite] = useState(Boolean(initial?.source_competition_id));
  const [source, setSource] = useState(initial?.source_competition_id ?? "");
  const [depth, setDepth] = useState<ResultsDepth>(initial?.results_depth ?? "final");

  return (
    <div className="comp-form-sub qualifier-form">
      <fieldset className="comp-form-choice">
        <legend>Is it on this site?</legend>
        <label>
          <input type="radio" checked={onSite} onChange={() => setOnSite(true)} /> Yes - its champion fills the place
        </label>
        <label>
          <input type="radio" checked={!onSite} onChange={() => setOnSite(false)} /> No - enter its results here
        </label>
      </fieldset>
      {onSite && (
        <div className="field">
          <label htmlFor="q-source">Competition</label>
          <select
            id="q-source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              const c = comps.find((x) => x.id === e.target.value);
              if (c && !name) setName(c.series.name);
            }}
          >
            <option value="">Choose one</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.series.name} {c.year} ({c.series.organiser.short_name})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="q-name">Name</label>
        <input id="q-name" placeholder="Fylde Classic" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="comp-form-grid">
        <div className="field">
          <label htmlFor="q-where">Where</label>
          <input id="q-where" placeholder="Kirkham" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="q-date">Date of the final</label>
          <input id="q-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {!onSite && (
        <fieldset className="comp-form-choice qualifier-depth">
          <legend>Results to enter</legend>
          {(Object.keys(DEPTH_LABEL) as ResultsDepth[]).map((d) => (
            <label key={d}>
              <input type="radio" checked={depth === d} onChange={() => setDepth(d)} /> {DEPTH_LABEL[d]}
            </label>
          ))}
        </fieldset>
      )}
      <div className="person-check-actions">
        <button
          type="button"
          disabled={busy || !name.trim() || (onSite && !source)}
          onClick={() =>
            onSave({
              name,
              location: location.trim() || null,
              final_date: date || null,
              source_competition_id: onSite ? source : null,
              results_depth: depth,
            })
          }
        >
          {initial ? "Save" : "Add it"}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

type Slot = { a: PersonDetails | null; b: PersonDetails | null; sa: string; sb: string };

function ResultsEditor({
  event,
  matches,
  names,
  clubs,
  busy,
  onSave,
  onCancel,
}: {
  event: QualifierEvent;
  matches: QualifierMatch[];
  names: Map<string, string>;
  clubs: Organiser[];
  busy: boolean;
  onSave: (matches: QualifierMatch[], winner: string | null) => void;
  onCancel: () => void;
}) {
  const asPerson = (id: string | null): PersonDetails | null =>
    id ? { id, full_name: names.get(id) ?? "", note: null, club_id: null, club_name: null, last_played: null } : null;
  const stages = stagesFor(event.results_depth);
  const [slots, setSlots] = useState<Record<string, Slot>>(() => {
    const initial: Record<string, Slot> = {};
    for (const stage of stages)
      for (let slot = 0; slot < matchesInStage(stage); slot++) {
        const m = matches.find((x) => x.stage === stage && x.slot === slot);
        initial[`${stage}:${slot}`] = {
          a: asPerson(m?.person_a_id ?? null),
          b: asPerson(m?.person_b_id ?? null),
          sa: m?.score_a?.toString() ?? "",
          sb: m?.score_b?.toString() ?? "",
        };
      }
    return initial;
  });
  const [winner, setWinner] = useState<PersonDetails | null>(asPerson(event.winner_person_id));
  const [problem, setProblem] = useState<string | null>(null);

  function set(key: string, patch: Partial<Slot>) {
    setSlots((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function save() {
    const list: QualifierMatch[] = Object.entries(slots).map(([key, s]) => {
      const [stage, slot] = key.split(":").map(Number);
      return {
        stage,
        slot,
        person_a_id: s.a?.id ?? null,
        person_b_id: s.b?.id ?? null,
        score_a: s.sa === "" ? null : Number(s.sa),
        score_b: s.sb === "" ? null : Number(s.sb),
      };
    });
    const p = resultsProblem(event.results_depth, list, winner?.id ?? null);
    setProblem(p);
    if (!p) onSave(list, winner?.id ?? null);
  }

  return (
    <div className="comp-form-sub qualifier-results">
      {event.results_depth === "winner" ? (
        <PersonPicker id={`win-${event.id}`} label="Winner" value={winner} onChange={setWinner} clubs={clubs} />
      ) : (
        stages.map((stage) => (
          <div key={stage}>
            <h4 className="qualifier-stage">{STAGE_LABEL[stage]}</h4>
            {Array.from({ length: matchesInStage(stage) }, (_, slot) => {
              const key = `${stage}:${slot}`;
              const s = slots[key];
              return (
                <div key={key} className="qualifier-match">
                  {(["a", "b"] as const).map((side) => (
                    <div key={side} className="qualifier-side">
                      <PersonPicker
                        id={`${event.id}-${key}-${side}`}
                        label={side === "a" ? "Player" : "Against"}
                        value={s[side]}
                        onChange={(p) => set(key, { [side]: p })}
                        clubs={clubs}
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="result-input"
                        aria-label="Score"
                        value={side === "a" ? s.sa : s.sb}
                        onChange={(e) => set(key, side === "a" ? { sa: e.target.value } : { sb: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))
      )}
      {problem && <p className="error">{problem}</p>}
      <p className="hint">The winner fills this competition&rsquo;s place in the list straight away.</p>
      <div className="person-check-actions">
        <button type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save results"}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
