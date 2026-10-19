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
  createCompetition,
  createOrganiser,
  createSeries,
  createVenue,
  listChoices,
  saveSponsors,
  updateCompetition,
  updateVenue,
  uploadSponsorLogo,
  type CompetitionInput,
  type CompetitionWithSeries,
  type SessionDetails,
  type SponsorInput,
} from "@/lib/competitionsApi";
import { errorMessage } from "@/lib/errors";
import { checkMapUrl, directionsUrl } from "@/lib/venues";
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
  onSaved,
}: {
  existing?: { competition: CompetitionWithSeries; sessions: Night[] };
  onSaved: (competitionId: string) => void;
}) {
  const c = existing?.competition;
  const locked = Boolean(c?.structure_locked);

  const [organisers, setOrganisers] = useState<Organiser[]>([]);
  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  // Who runs it and which competition (new only)
  const [organiserId, setOrganiserId] = useState<string>("");
  const [newOrganiser, setNewOrganiser] = useState({ name: "", short_name: "", kind: "club" as "club" | "event" });
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
  const [newVenue, setNewVenue] = useState({ name: "", address: "", postcode: "", notes: "", map_url: "" });
  // Correcting the chosen venue's details (changes it for every competition using it)
  const [editVenue, setEditVenue] = useState<typeof newVenue | null>(null);

  // Sessions' dates and start times, in plan order
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
        setAllSeries(choices.series);
        setVenues(choices.venues);
      })
      .catch((err) => setError(errorMessage(err)));
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
          current[i]?.practice_time ?? addMinutes(current[i]?.start_time ?? DEFAULT_START[p.kind], -30),
      }))
    );
  }, [plan]);

  const seriesForOrganiser = allSeries.filter((s) => s.organiser_id === organiserId);

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
      let chosenVenueId: string | null = venueId || null;
      if (venueId === "new") {
        if (!newVenue.name.trim()) throw new Error("Enter the new venue's name.");
        const map = checkMapUrl(newVenue.map_url);
        if (map.problem) throw new Error(map.problem);
        const v = await createVenue({
          name: newVenue.name.trim(),
          address: newVenue.address.trim() || null,
          postcode: newVenue.postcode.trim() || null,
          notes: newVenue.notes.trim() || null,
          map_url: map.url,
        });
        chosenVenueId = v.id;
      } else if (venueId && editVenue) {
        if (!editVenue.name.trim()) throw new Error("Enter the venue's name.");
        const map = checkMapUrl(editVenue.map_url);
        if (map.problem) throw new Error(map.problem);
        const v = await updateVenue(venueId, {
          name: editVenue.name.trim(),
          address: editVenue.address.trim() || null,
          postcode: editVenue.postcode.trim() || null,
          notes: editVenue.notes.trim() || null,
          map_url: map.url,
        });
        setVenues((current) => current.map((x) => (x.id === v.id ? v : x)));
        setEditVenue(null);
      }

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
        await updateCompetition(c, settings, existing.sessions, sessions);
        await saveSponsors(c.id, sponsors);
        onSaved(c.id);
        return;
      }

      let chosenOrganiserId = organiserId;
      if (!organiserId && organisers.length > 0) throw new Error("Choose who runs it.");
      if (organiserId === "new" || !organiserId) {
        if (!newOrganiser.name.trim() || !newOrganiser.short_name.trim()) {
          throw new Error("Enter who runs it - the full name and the short name.");
        }
        const o = await createOrganiser({
          name: newOrganiser.name.trim(),
          short_name: newOrganiser.short_name.trim(),
          kind: newOrganiser.kind,
        });
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

  return (
    <form onSubmit={handleSubmit} className="comp-form">
      {!existing && (
        <section className="card">
          <h2>Competition</h2>
          <div className="field">
            <label htmlFor="cf-organiser">Run by</label>
            <select
              id="cf-organiser"
              value={organiserId || (organisers.length ? "" : "new")}
              onChange={(e) => {
                setOrganiserId(e.target.value);
                setSeriesId("");
              }}
            >
              <option value="" disabled>
                Choose a club or event
              </option>
              {organisers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.short_name} ({o.kind === "club" ? "club" : "event"})
                </option>
              ))}
              <option value="new">+ A new club or event</option>
            </select>
          </div>
          {(organiserId === "new" || organisers.length === 0) && (
            <div className="comp-form-sub">
              <div className="field">
                <label htmlFor="cf-org-name">Full name</label>
                <input
                  id="cf-org-name"
                  placeholder="Penwortham Sports & Social Club"
                  value={newOrganiser.name}
                  onChange={(e) => setNewOrganiser({ ...newOrganiser, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="cf-org-short">Short name</label>
                <input
                  id="cf-org-short"
                  placeholder="Penwortham"
                  value={newOrganiser.short_name}
                  onChange={(e) => setNewOrganiser({ ...newOrganiser, short_name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="cf-org-kind">Type</label>
                <select
                  id="cf-org-kind"
                  value={newOrganiser.kind}
                  onChange={(e) => setNewOrganiser({ ...newOrganiser, kind: e.target.value as "club" | "event" })}
                >
                  <option value="club">Club</option>
                  <option value="event">Standalone event (e.g. Blackpool Masters)</option>
                </select>
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="cf-series">Competition</label>
            <select id="cf-series" value={seriesId || "new"} onChange={(e) => setSeriesId(e.target.value)}>
              {seriesForOrganiser.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} - a new year
                </option>
              ))}
              <option value="new">+ A new competition</option>
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
              <option value="on_the_night">Entered on the night</option>
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
        <p className="hint">
          Leave a date empty if it isn&rsquo;t known yet - it shows as &ldquo;Dates to be confirmed&rdquo;. Clear the
          practice time if there&rsquo;s no practice.
        </p>
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
              <label className="comp-form-session-field">
                <span>Practice</span>
                <input
                  type="time"
                  aria-label={`Practice time for ${SESSION_LABEL[p.kind]} ${p.session_number}`}
                  value={sessions[i]?.practice_time ?? ""}
                  onChange={(e) => setSession(i, "practice_time", e.target.value)}
                />
              </label>
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
        <h2>Venue and sponsor</h2>
        <div className="field">
          <label htmlFor="cf-venue">Venue</label>
          <select
            id="cf-venue"
            value={venueId}
            onChange={(e) => {
              setVenueId(e.target.value);
              setEditVenue(null);
            }}
          >
            <option value="">Not set yet</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.postcode ? ` (${v.postcode})` : ""}
              </option>
            ))}
            <option value="new">+ A new venue</option>
          </select>
        </div>
        {venueId === "new" && (
          <div className="comp-form-sub">
            <div className="field">
              <label htmlFor="cf-venue-name">Venue name</label>
              <input id="cf-venue-name" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cf-venue-address">Address</label>
              <input id="cf-venue-address" value={newVenue.address} onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cf-venue-postcode">Postcode</label>
              <input id="cf-venue-postcode" value={newVenue.postcode} onChange={(e) => setNewVenue({ ...newVenue, postcode: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cf-venue-notes">Notes for spectators (optional)</label>
              <input
                id="cf-venue-notes"
                placeholder="Parking on site. Bar open, seating available"
                value={newVenue.notes}
                onChange={(e) => setNewVenue({ ...newVenue, notes: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="cf-venue-map">Google Maps link (optional)</label>
              <input
                id="cf-venue-map"
                type="url"
                placeholder="https://maps.app.goo.gl/..."
                value={newVenue.map_url}
                onChange={(e) => setNewVenue({ ...newVenue, map_url: e.target.value })}
              />
              <p className="hint">
                For the exact spot, if searching the address doesn&rsquo;t find it: in Google Maps, find the green,
                tap Share, copy the link and paste it here.
              </p>
            </div>
          </div>
        )}
        {venueId && venueId !== "new" && (() => {
          const chosen = venues.find((v) => v.id === venueId);
          if (!chosen) return null;
          if (!editVenue) {
            return (
              <p className="hint">
                <a href={directionsUrl(chosen)} target="_blank" rel="noopener noreferrer">
                  Check the directions
                </a>{" "}
                &middot;{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    setEditVenue({
                      name: chosen.name,
                      address: chosen.address ?? "",
                      postcode: chosen.postcode ?? "",
                      notes: chosen.notes ?? "",
                      map_url: chosen.map_url ?? "",
                    })
                  }
                >
                  Correct this venue&rsquo;s details
                </button>
              </p>
            );
          }
          return (
            <div className="comp-form-sub">
              <p className="hint">Changes this venue wherever it&rsquo;s used. Saved with the rest of the form.</p>
              {(
                [
                  ["name", "Venue name"],
                  ["address", "Address"],
                  ["postcode", "Postcode"],
                  ["notes", "Notes for spectators (optional)"],
                  ["map_url", "Google Maps link (optional)"],
                ] as const
              ).map(([field, text]) => (
                <div key={field} className="field">
                  <label htmlFor={`cf-edit-venue-${field}`}>{text}</label>
                  <input
                    id={`cf-edit-venue-${field}`}
                    type={field === "map_url" ? "url" : "text"}
                    value={editVenue[field]}
                    onChange={(e) => setEditVenue({ ...editVenue, [field]: e.target.value })}
                  />
                </div>
              ))}
              <button type="button" className="link-button" onClick={() => setEditVenue(null)}>
                Don&rsquo;t change the venue
              </button>
            </div>
          );
        })()}
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
