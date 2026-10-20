"use client";

import { useEffect, useMemo, useState } from "react";
import {
  finalsFill,
  planSessions,
  settingsProblems,
  slugify,
  type CompetitionFormat,
  type SessionKind,
} from "@/lib/competitionSetup";
import {
  listCompetitions,
  moveSeries,
  createCompetition,
  createOrganiser,
  createSeries,
  listChoices,
  saveSponsors,
  updateCompetition,
  uploadSponsorLogo,
  type CompetitionInput,
  type CompetitionWithSeries,
  type SessionDetails,
  type SponsorInput,
} from "@/lib/competitionsApi";
import { errorMessage } from "@/lib/errors";
import Link from "next/link";
import { directionsUrl } from "@/lib/venues";
import { addMinutes } from "@/lib/timeSlots";
import type { Night, Organiser, Series, Venue } from "@/lib/types";

const DEFAULT_START: Record<SessionKind, string> = {
  qualifier: "19:00",
  finals: "13:00",
  single_day: "10:00",
  final: "14:00",
};

const SESSION_LABEL: Record<SessionKind, string> = {
  qualifier: "Qualifying session",
  finals: "Finals Day",
  single_day: "The day",
  final: "The final",
};

const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

// Set up a new competition, or change an existing one's settings. Super only.
// Once a draw has been made the structure is locked and only the details
// (status, label, sponsor, venue, dates) can change.
export default function CompetitionForm({
  existing,
  presetOrganiserId,
  presetKind,
  onSaved,
}: {
  existing?: { competition: CompetitionWithSeries; sessions: Night[] };
  // "+ Add another competition to the Blackpool Masters": that event, chosen already
  presetOrganiserId?: string;
  // "New event" on the Events page: start on "Part of an event"
  presetKind?: "club" | "event";
  onSaved: (competitionId: string) => void;
}) {
  const c = existing?.competition;
  const locked = Boolean(c?.structure_locked);

  const [organisers, setOrganisers] = useState<Organiser[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  // What it is (new only): a club's competition, or part of an event - and
  // which club or event ("new" for one not in the list yet)
  const [kind, setKind] = useState<"club" | "event">(presetKind ?? "club");
  const [organiserId, setOrganiserId] = useState<string>(presetOrganiserId ?? "");
  const [newOrgName, setNewOrgName] = useState("");
  // Changing: which club or event it's part of (moves every year of it)
  const [partOf, setPartOf] = useState<string>(c?.series.organiser_id ?? "");
  // Each competition's venue, for defaulting to the one a club used last
  const [pastVenues, setPastVenues] = useState<{ organiserId: string; venueId: string; year: number }[]>([]);
  const [seriesId, setSeriesId] = useState<string>("");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [newSeriesSlug, setNewSeriesSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  // Settings
  const [year, setYear] = useState<number>(c?.year ?? new Date().getFullYear() + 1);
  const [status, setStatus] = useState<CompetitionInput["status"]>(c?.status ?? "planned");
  const [format, setFormat] = useState<CompetitionFormat>(c?.format ?? "qualifying_and_finals");
  const [teamSize, setTeamSize] = useState<1 | 2>(c?.team_size ?? 1);
  const [targetScore, setTargetScore] = useState<21 | 31>(c?.target_score ?? 21);
  const [scoringStyle, setScoringStyle] = useState<CompetitionInput["scoring_style"]>(c?.scoring_style ?? "live");
  const [entryMethod, setEntryMethod] = useState<CompetitionInput["entry_method"]>(c?.entry_method ?? "open");
  const [drawMethod, setDrawMethod] = useState<CompetitionInput["draw_method"]>(c?.draw_method ?? "in_advance");
  const [label, setLabel] = useState(c?.label ?? "");
  const [drawSize, setDrawSize] = useState(c?.draw_size?.toString() ?? "16");
  const [nights, setNights] = useState(c?.qualifying_nights?.toString() ?? "4");
  const [perNight, setPerNight] = useState(c?.entries_per_night?.toString() ?? "16");
  const [through, setThrough] = useState(c?.qualifiers_per_night?.toString() ?? "4");
  // Sponsors, in the order shown - one empty row to start with
  const [sponsors, setSponsors] = useState<SponsorInput[]>(() =>
    c?.sponsors?.length
      ? c.sponsors.map((s) => ({ name: s.name, url: s.url ?? "", logo_url: s.logo_url ?? null }))
      : [{ name: "", url: "", logo_url: null }]
  );

  // Venue
  const [venueId, setVenueId] = useState<string>(c?.venue_id ?? "");

  // Sessions' dates and start times, in plan order
  // Some competitions have no practice: untick to leave practice times off
  const [hasPractice, setHasPractice] = useState(
    () => !existing || existing.sessions.length === 0 || existing.sessions.some((x) => x.practice_time)
  );
  const [sessions, setSessions] = useState<SessionDetails[]>(() =>
    (existing?.sessions ?? []).map((s) => ({
      date: s.date ?? null,
      start_time: s.start_time?.slice(0, 5) ?? null,
      practice_time: s.practice_time?.slice(0, 5) ?? null,
    }))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listChoices()
      .then((choices) => {
        setOrganisers(choices.organisers);
        const preset = choices.organisers.find((o) => o.id === presetOrganiserId);
        if (preset) setKind(preset.kind);
        setAllSeries(choices.series);
        setVenues(choices.venues);
      })
      .catch((err) => setError(errorMessage(err)));
    if (!existing) {
      listCompetitions()
        .then((all) =>
          setPastVenues(
            all
              .filter((x) => x.venue_id)
              .map((x) => ({ organiserId: x.series.organiser_id, venueId: x.venue_id!, year: x.year }))
          )
        )
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const structure = {
    format,
    team_size: teamSize,
    target_score: targetScore,
    draw_size: format === "final_only" ? 2 : numberOrNull(drawSize),
    qualifying_nights: format === "qualifying_and_finals" ? numberOrNull(nights) : null,
    entries_per_night: format === "qualifying_and_finals" ? numberOrNull(perNight) : null,
    qualifiers_per_night: format === "qualifying_and_finals" ? numberOrNull(through) : null,
  };
  const problems = settingsProblems(structure);
  const fill = finalsFill(structure);
  const plan = useMemo(
    () => planSessions(format, structure.qualifying_nights),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format, structure.qualifying_nights]
  );

  // Keep one date/time row per planned session, with sensible start times
  useEffect(() => {
    setSessions((current) =>
      plan.map((p, i) => ({
        date: current[i]?.date ?? null,
        start_time: current[i]?.start_time ?? DEFAULT_START[p.kind],
        // Practice half an hour before, to begin with
        practice_time:
          current[i]?.practice_time ??
          (hasPractice ? addMinutes(current[i]?.start_time ?? DEFAULT_START[p.kind], -30) : null),
      }))
    );
  }, [plan]);

  const seriesForOrganiser = allSeries.filter((s) => s.organiser_id === organiserId);
  const organisersOfKind = organisers.filter((o) => o.kind === kind);
  const chosenOrganiser = organisers.find((o) => o.id === organiserId) ?? null;

  // Picking a club or event: where it usually plays, if the venue's not set
  function chooseOrganiser(id: string) {
    setOrganiserId(id);
    setSeriesId("");
    if (!venueId) {
      const last = pastVenues.filter((p) => p.organiserId === id).sort((a, b) => b.year - a.year)[0];
      if (last) setVenueId(last.venueId);
    }
  }

  function setSponsor(i: number, field: keyof SponsorInput, value: string | null) {
    setSponsors((current) => current.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
  }

  // Logos upload straight away (so they can be seen) and are saved against
  // the sponsor with the rest of the form
  const [uploading, setUploading] = useState<number | null>(null);
  async function chooseLogo(i: number, file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(i);
    try {
      setSponsor(i, "logo_url", await uploadSponsorLogo(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(null);
    }
  }

  function setSession(i: number, field: keyof SessionDetails, value: string) {
    setSessions((current) =>
      current.map((s, j) => {
        if (j !== i) return s;
        const next = { ...s, [field]: value || null };
        // Moving the start moves practice with it, if practice was still the
        // usual half an hour before
        if (field === "start_time" && value && s.start_time && s.practice_time === addMinutes(s.start_time, -30)) {
          next.practice_time = addMinutes(value, -30);
        }
        return next;
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (problems.length > 0) {
      setError(problems[0]);
      return;
    }
    setSaving(true);
    try {
      const chosenVenueId: string | null = venueId || null;

      const settings: Partial<CompetitionInput> = {
        year,
        status,
        label: label.trim() || null,
        venue_id: chosenVenueId,
        ...(locked
          ? {}
          : {
              ...structure,
              scoring_style: scoringStyle,
              entry_method: entryMethod,
              draw_method: drawMethod,
            }),
      };

      if (existing && c) {
        if (partOf && partOf !== c.series.organiser_id) await moveSeries(c.series.id, partOf);
        await updateCompetition(c, settings, existing.sessions, sessions);
        await saveSponsors(c.id, sponsors);
        onSaved(c.id);
        return;
      }

      let chosenOrganiserId = organiserId;
      const noun = kind === "club" ? "club" : "event";
      if (!organiserId && organisersOfKind.length > 0) throw new Error(`Choose the ${noun}.`);
      if (organiserId === "new" || !organiserId) {
        if (!newOrgName.trim()) throw new Error(`Enter the ${noun}'s name.`);
        const o = await createOrganiser({ name: newOrgName.trim(), short_name: newOrgName.trim(), kind });
        chosenOrganiserId = o.id;
      }
      let chosenSeriesId = seriesId;
      if (seriesId === "new" || !seriesId) {
        const slug = slugify(newSeriesSlug || newSeriesName);
        if (!newSeriesName.trim() || !slug) throw new Error("Enter the competition's name.");
        const s = await createSeries({ organiser_id: chosenOrganiserId, name: newSeriesName.trim(), slug });
        chosenSeriesId = s.id;
      }

      const created = await createCompetition(
        // Sponsors live in their own list now; the old single-sponsor columns stay empty
        { ...(settings as CompetitionInput), series_id: chosenSeriesId, colour: null, sponsor_name: null, sponsor_url: null },
        sessions
      );
      await saveSponsors(created.id, sponsors);
      onSaved(created.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Where it's played: next to the club or event when setting up, with the
  // sponsors when changing
  const venueField = (
    <>
        <div className="field">
          <label htmlFor="cf-venue">{existing ? "Venue" : "Where is it played?"}</label>
          <select
            id="cf-venue"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
          >
            <option value="">Not set yet</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.postcode ? ` (${v.postcode})` : ""}
              </option>
            ))}
          </select>
        </div>
        <p className="hint">
          {venueId && venues.find((v) => v.id === venueId) && (
            <>
              <a href={directionsUrl(venues.find((v) => v.id === venueId)!)} target="_blank" rel="noopener noreferrer">
                Check the directions
              </a>{" "}
              &middot;{" "}
            </>
          )}
          Not in the list, or details to correct? <Link href="/admin/venues">Venues</Link>
        </p>
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="comp-form">
      {!existing && (
        <section className="card">
          <h2>What is it?</h2>
          <fieldset className="comp-form-choice">
            <legend className="visually-hidden">What is it?</legend>
            <label>
              <input
                type="radio"
                name="cf-kind"
                checked={kind === "club"}
                onChange={() => {
                  setKind("club");
                  setOrganiserId("");
                  setSeriesId("");
                }}
              />
              A club competition
            </label>
            <label>
              <input
                type="radio"
                name="cf-kind"
                checked={kind === "event"}
                onChange={() => {
                  setKind("event");
                  setOrganiserId("");
                  setSeriesId("");
                }}
              />
              Part of an event (e.g. the Blackpool Masters)
            </label>
          </fieldset>

          <div className="field">
            <label htmlFor="cf-organiser">{kind === "club" ? "Which club?" : "Which event?"}</label>
            <select
              id="cf-organiser"
              value={organiserId || (organisersOfKind.length ? "" : "new")}
              onChange={(e) => chooseOrganiser(e.target.value)}
            >
              <option value="" disabled>
                {kind === "club" ? "Choose a club" : "Choose an event"}
              </option>
              {organisersOfKind.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
              <option value="new">{kind === "club" ? "+ A new club" : "+ A new event"}</option>
            </select>
          </div>
          {(organiserId === "new" || organisersOfKind.length === 0) && (
            <div className="comp-form-sub">
              <div className="field">
                <label htmlFor="cf-org-name">{kind === "club" ? "The club's name" : "The event's name"}</label>
                <input
                  id="cf-org-name"
                  placeholder={kind === "club" ? "Penwortham" : "Blackpool Masters"}
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
                <p className="hint">
                  {kind === "club"
                    ? `Shown as "Run by ${newOrgName.trim() || "Penwortham"}".`
                    : `Its own page will be at /${slugify(newOrgName) || "blackpool-masters"}, with all its competitions.`}
                </p>
              </div>
            </div>
          )}

          {venueField}

          <div className="field">
            <label htmlFor="cf-series">The competition</label>
            <select id="cf-series" value={seriesId || "new"} onChange={(e) => setSeriesId(e.target.value)}>
              {seriesForOrganiser.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} - a new year of it
                </option>
              ))}
              <option value="new">
                {chosenOrganiser?.kind === "event" || kind === "event"
                  ? `+ A new competition in ${chosenOrganiser?.name ?? "this event"}`
                  : "+ A new competition"}
              </option>
            </select>
          </div>
          {(seriesId === "new" || !seriesId) && (
            <div className="comp-form-sub">
              <div className="field">
                <label htmlFor="cf-series-name">Name</label>
                <input
                  id="cf-series-name"
                  placeholder="Spring Doubles"
                  value={newSeriesName}
                  onChange={(e) => {
                    setNewSeriesName(e.target.value);
                    if (!slugEdited) setNewSeriesSlug(slugify(e.target.value));
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="cf-series-slug">Web address</label>
                <div className="comp-form-slug">
                  <span>/</span>
                  <input
                    id="cf-series-slug"
                    value={newSeriesSlug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setNewSeriesSlug(e.target.value);
                    }}
                  />
                </div>
                <p className="hint">Always opens the latest year. Can&rsquo;t be changed later.</p>
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="cf-year">Year</label>
            <input
              id="cf-year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
        </section>
      )}

      <section className="card">
        <h2>Format</h2>
        {existing && (
          <div className="field">
            <label htmlFor="cf-part-of">Part of</label>
            <select id="cf-part-of" value={partOf} onChange={(e) => setPartOf(e.target.value)}>
              {(["event", "club"] as const).map((k) => (
                <optgroup key={k} label={k === "event" ? "Events" : "Clubs"}>
                  {organisers
                    .filter((o) => o.kind === k)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <p className="hint">Moves this competition (every year of it) to a different club or event.</p>
          </div>
        )}
        {locked && (
          <p className="comp-form-locked">
            A draw has been made, so the format is locked. Dates, venue, sponsor and status can still change.
          </p>
        )}
        <fieldset className="comp-form-choice" disabled={locked}>
          <legend>Format</legend>
          {(
            [
              ["qualifying_and_finals", "Qualifying sessions + Finals Day"],
              ["single_day", "Single day"],
              ["final_only", "Final only (results from elsewhere)"],
            ] as const
          ).map(([value, text]) => (
            <label key={value}>
              <input type="radio" name="cf-format" checked={format === value} onChange={() => setFormat(value)} />
              {text}
            </label>
          ))}
        </fieldset>
        <fieldset className="comp-form-choice" disabled={locked}>
          <legend>Singles or doubles</legend>
          <label>
            <input type="radio" name="cf-team" checked={teamSize === 1} onChange={() => setTeamSize(1)} />
            Singles
          </label>
          <label>
            <input type="radio" name="cf-team" checked={teamSize === 2} onChange={() => setTeamSize(2)} />
            Doubles (pairs)
          </label>
        </fieldset>

        {format === "qualifying_and_finals" && (
          <div className="comp-form-grid">
            <div className="field">
              <label htmlFor="cf-nights">Qualifying sessions</label>
              <input id="cf-nights" type="number" min={1} disabled={locked} value={nights} onChange={(e) => setNights(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cf-per-night">{teamSize === 2 ? "Pairs" : "Players"} each session</label>
              <input id="cf-per-night" type="number" min={2} disabled={locked} value={perNight} onChange={(e) => setPerNight(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cf-through">Go through each session</label>
              <input id="cf-through" type="number" min={1} disabled={locked} value={through} onChange={(e) => setThrough(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cf-draw">Finals Day draw</label>
              <input id="cf-draw" type="number" min={2} disabled={locked} value={drawSize} onChange={(e) => setDrawSize(e.target.value)} />
            </div>
          </div>
        )}
        {format === "single_day" && (
          <div className="field">
            <label htmlFor="cf-draw-single">{teamSize === 2 ? "Pairs" : "Players"} in the draw</label>
            <input id="cf-draw-single" type="number" min={2} disabled={locked} value={drawSize} onChange={(e) => setDrawSize(e.target.value)} />
          </div>
        )}
        {fill && (
          <p className="hint">
            {fill.through} go through to Finals Day
            {fill.byes > 0 ? `, leaving ${fill.byes} bye${fill.byes === 1 ? "" : "s"} in the draw of ${structure.draw_size}` : ", filling the draw"}.
          </p>
        )}
        {problems.length > 0 && <p className="error">{problems[0]}</p>}

        <div className="comp-form-grid">
          <div className="field">
            <label htmlFor="cf-target">Winning score</label>
            <select id="cf-target" disabled={locked} value={targetScore} onChange={(e) => setTargetScore(Number(e.target.value) as 21 | 31)}>
              <option value={21}>21 up</option>
              <option value={31}>31 up</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cf-scoring">Scoring</label>
            <select id="cf-scoring" disabled={locked} value={scoringStyle} onChange={(e) => setScoringStyle(e.target.value as typeof scoringStyle)}>
              <option value="live">Live, point by point</option>
              <option value="results">Results only</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cf-entry">Entry</label>
            <select id="cf-entry" disabled={locked} value={entryMethod} onChange={(e) => setEntryMethod(e.target.value as typeof entryMethod)}>
              <option value="open">Open - the organiser enters players</option>
              <option value="qualification">By qualification and wildcards</option>
              <option value="on_the_night">Entered on the day</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cf-drawmethod">Draw</label>
            <select id="cf-drawmethod" disabled={locked} value={drawMethod} onChange={(e) => setDrawMethod(e.target.value as typeof drawMethod)}>
              <option value="in_advance">Made in advance</option>
              <option value="on_the_day">Made on the day</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="cf-label">Label (optional)</label>
          <input id="cf-label" placeholder="e.g. Ladies" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </section>

      <section className="card">
        <h2>Dates</h2>
        <p className="hint">Leave a date empty if it isn&rsquo;t known yet - it shows as &ldquo;Dates to be confirmed&rdquo;.</p>
        <label className="comp-form-check">
          <input
            type="checkbox"
            checked={hasPractice}
            onChange={(e) => {
              const on = e.target.checked;
              setHasPractice(on);
              // Back on: practice half an hour before each start, to begin with
              setSessions((current) =>
                current.map((x) => ({
                  ...x,
                  practice_time: on ? (x.start_time ? addMinutes(x.start_time, -30) : null) : null,
                }))
              );
            }}
          />
          Practice before each session
        </label>
        <div className="comp-form-sessions">
          {plan.map((p, i) => (
            <div key={`${p.kind}-${p.session_number}`} className="comp-form-session">
              <span className="comp-form-session-name">
                {p.kind === "qualifier" ? `${SESSION_LABEL.qualifier} ${p.session_number}` : SESSION_LABEL[p.kind]}
              </span>
              <label className="comp-form-session-field">
                <span>Date</span>
                <input
                  type="date"
                  aria-label={`Date for ${SESSION_LABEL[p.kind]} ${p.session_number}`}
                  value={sessions[i]?.date ?? ""}
                  onChange={(e) => setSession(i, "date", e.target.value)}
                />
              </label>
              {hasPractice && (
              <label className="comp-form-session-field">
                <span>Practice</span>
                <input
                  type="time"
                  aria-label={`Practice time for ${SESSION_LABEL[p.kind]} ${p.session_number}`}
                  value={sessions[i]?.practice_time ?? ""}
                  onChange={(e) => setSession(i, "practice_time", e.target.value)}
                />
              </label>
              )}
              <label className="comp-form-session-field">
                <span>Start</span>
                <input
                  type="time"
                  aria-label={`Start time for ${SESSION_LABEL[p.kind]} ${p.session_number}`}
                  value={sessions[i]?.start_time ?? ""}
                  onChange={(e) => setSession(i, "start_time", e.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>{existing ? "Venue and sponsors" : "Sponsors"}</h2>
        {existing && venueField}
        <div className="comp-form-sponsors">
          <span className="comp-form-sponsors-title">Sponsors (optional)</span>
          {sponsors.map((sponsor, i) => (
            <div key={i} className="comp-form-sponsor">
              <div className="field">
                <label htmlFor={`cf-sponsor-${i}`}>{sponsors.length > 1 ? `Sponsor ${i + 1}` : "Sponsor"}</label>
                <input id={`cf-sponsor-${i}`} value={sponsor.name} onChange={(e) => setSponsor(i, "name", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`cf-sponsor-url-${i}`}>Website</label>
                <input
                  id={`cf-sponsor-url-${i}`}
                  type="url"
                  placeholder="https://"
                  value={sponsor.url}
                  onChange={(e) => setSponsor(i, "url", e.target.value)}
                />
              </div>
              {sponsors.length > 1 && (
                <button
                  type="button"
                  className="link-button comp-form-remove"
                  onClick={() => setSponsors((current) => current.filter((_, j) => j !== i))}
                  aria-label={`Remove ${sponsor.name || `sponsor ${i + 1}`}`}
                >
                  Remove
                </button>
              )}
              <div className="comp-form-logo">
                {sponsor.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sponsor.logo_url} alt={`${sponsor.name || "Sponsor"} logo`} className="comp-form-logo-img" />
                )}
                <label className="link-button comp-form-logo-pick">
                  {uploading === i ? "Uploading…" : sponsor.logo_url ? "Change logo" : "Add a logo (optional)"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                    className="visually-hidden"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      chooseLogo(i, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {sponsor.logo_url && (
                  <button type="button" className="link-button" onClick={() => setSponsor(i, "logo_url", null)}>
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="link-button"
            onClick={() => setSponsors((current) => [...current, { name: "", url: "", logo_url: null }])}
          >
            + Add another sponsor
          </button>
        </div>
        <div className="field">
          <label htmlFor="cf-status">Status</label>
          <select id="cf-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="planned">Planned - shown with its dates, nothing to open yet</option>
            <option value="active">Active - the current one</option>
            <option value="archived">Archived - finished, results kept</option>
          </select>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : existing ? "Save changes" : "Create competition"}
      </button>
    </form>
  );
}
