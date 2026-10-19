"use client";

import { useState } from "react";
import { longDate } from "@/lib/competitionSetup";
import { errorMessage } from "@/lib/errors";
import { sessionTimes } from "@/lib/publicCompetitions";
import { originalDateLabel, postponedLabel } from "@/lib/venues";
import type { Night, Venue } from "@/lib/types";

// A session's date and venue, for its admins: postpone it (rained off), give
// or change the new date, or take the postponement back; and play it
// somewhere other than the competition's usual venue.
export default function SessionSettings({
  session,
  venues,
  competitionVenueId,
  onPostpone,
  onCancelPostponement,
  onSetVenue,
}: {
  session: Night;
  venues: Venue[];
  competitionVenueId: string | null;
  onPostpone: (reason: string, newDate: string | null) => Promise<void>;
  onCancelPostponement: () => Promise<void>;
  onSetVenue: (venueId: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(session.postponed_reason ?? "Rained off");
  const [newDate, setNewDate] = useState(session.postponed ? (session.date ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const competitionVenue = venues.find((v) => v.id === competitionVenueId) ?? null;
  const label = postponedLabel(session);
  const was = originalDateLabel(session);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card session-settings ${session.postponed ? "session-settings-postponed" : ""}`}>
      <div className="session-settings-row">
        <span className="session-settings-main">
          {label ? (
            <>
              <strong>{label}</strong>
              {was && <span className="hint">{was}</span>}
            </>
          ) : (
            <>
              <strong>{session.date ? longDate(session.date) : "Date to be confirmed"}</strong>
              {sessionTimes(session) && <span className="hint">{sessionTimes(session)}</span>}
            </>
          )}
        </span>
        {!editing && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setReason(session.postponed_reason ?? "Rained off");
              setNewDate(session.postponed ? (session.date ?? "") : "");
              setError(null);
              setEditing(true);
            }}
          >
            {session.postponed ? "Change" : "Postpone"}
          </button>
        )}
      </div>

      {editing && (
        <div className="comp-form-sub session-settings-form">
          <div className="field">
            <label htmlFor="postpone-reason">Reason (shown publicly)</label>
            <input id="postpone-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="postpone-date">New date</label>
            <input id="postpone-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <p className="hint">
              Leave empty if it isn&rsquo;t known yet. The draw, entries and any finished matches stay as they are;
              the rest are played on the new date.
            </p>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="person-check-actions">
            <button type="button" disabled={busy} onClick={() => run(() => onPostpone(reason, newDate || null))}>
              {busy ? "Saving…" : session.postponed ? "Save" : "Postpone"}
            </button>
            {session.postponed && (
              <button
                type="button"
                className="link-button"
                disabled={busy}
                onClick={() => {
                  if (confirm("Not postponed after all? It goes back to its first date.")) run(onCancelPostponement);
                }}
              >
                Not postponed after all
              </button>
            )}
            <button type="button" className="link-button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="field session-settings-venue">
        <label htmlFor="session-venue">Venue</label>
        <select
          id="session-venue"
          value={session.venue_id ?? ""}
          disabled={busy}
          onChange={(e) => run(() => onSetVenue(e.target.value || null))}
        >
          <option value="">
            {competitionVenue ? `The competition's venue (${competitionVenue.name})` : "The competition's venue (not set yet)"}
          </option>
          {venues
            .filter((v) => v.id !== competitionVenueId)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.postcode ? ` (${v.postcode})` : ""}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
