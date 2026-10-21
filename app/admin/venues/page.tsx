"use client";

import { useEffect, useState } from "react";
import { useIsSuper } from "@/lib/auth";
import {
  createVenue,
  deleteVenue,
  listClubs,
  listVenues,
  setVenueClub,
  updateVenue,
  venueUsage,
  type VenueInput,
} from "@/lib/competitionsApi";
import { errorMessage } from "@/lib/errors";
import { SITE_NAME } from "@/lib/site";
import { checkMapUrl, directionsUrl } from "@/lib/venues";
import type { Organiser, Venue } from "@/lib/types";

type Form = { name: string; address: string; postcode: string; notes: string; map_url: string };
const EMPTY: Form = { name: "", address: "", postcode: "", notes: "", map_url: "" };

// "Also a club": which club ("new" for one made from the venue) and, for a
// new one, the short name its pills show
type ClubChoice = { on: boolean; clubId: string; shortName: string };
const NO_CLUB: ClubChoice = { on: false, clubId: "new", shortName: "" };

const FIELDS: [keyof Form, string, string][] = [
  ["name", "Venue name", "Penwortham Sports & Social Club"],
  ["address", "Address", "Hill Road, Penwortham"],
  ["postcode", "Postcode", "PR1 9XH"],
  ["notes", "Notes for spectators (optional)", "Parking on site. Bar open, seating available"],
  ["map_url", "Google Maps link (optional)", "https://maps.app.goo.gl/..."],
];

function toInput(f: Form): VenueInput {
  const map = checkMapUrl(f.map_url);
  if (map.problem) throw new Error(map.problem);
  if (!f.name.trim()) throw new Error("Enter the venue's name.");
  return {
    name: f.name.trim(),
    address: f.address.trim() || null,
    postcode: f.postcode.trim() || null,
    notes: f.notes.trim() || null,
    map_url: map.url,
  };
}

// Where competitions are played, kept in one place (Super). A competition
// picks its venue from this list, and so can a single session played
// somewhere else. Correcting a venue here changes it everywhere it's used.
export default function VenuesPage() {
  const isSuper = useIsSuper();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [used, setUsed] = useState<Map<string, number>>(new Map());
  const [editing, setEditing] = useState<string | null>(null); // venue id, or "new"
  const [form, setForm] = useState<Form>(EMPTY);
  const [clubList, setClubList] = useState<Organiser[]>([]);
  const [clubChoice, setClubChoice] = useState<ClubChoice>(NO_CLUB);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      const [list, usage, clubRows] = await Promise.all([listVenues(), venueUsage(), listClubs()]);
      setVenues(list);
      setUsed(usage);
      setClubList(clubRows);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    document.title = `Venues · Admin · ${SITE_NAME}`;
  }, []);

  useEffect(() => {
    if (isSuper) load();
  }, [isSuper]);

  function open(v: Venue | null) {
    setError(null);
    setMessage(null);
    setEditing(v ? v.id : "new");
    const linked = v ? clubList.find((o) => o.venue_id === v.id) : undefined;
    setClubChoice(linked ? { on: true, clubId: linked.id, shortName: linked.short_name } : NO_CLUB);
    setForm(
      v
        ? { name: v.name, address: v.address ?? "", postcode: v.postcode ?? "", notes: v.notes ?? "", map_url: v.map_url ?? "" }
        : EMPTY
    );
  }

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMessage(done);
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    run(async () => {
      const input = toInput(form);
      const saved = editing === "new" ? await createVenue(input) : editing ? await updateVenue(editing, input) : null;
      if (!saved) return;
      const linked = clubList.find((o) => o.venue_id === saved.id);
      if (!clubChoice.on) {
        if (linked) await setVenueClub(saved, null);
      } else if (clubChoice.clubId === "new") {
        await setVenueClub(saved, { shortName: clubChoice.shortName || saved.name });
      } else if (linked?.id !== clubChoice.clubId) {
        await setVenueClub(saved, { organiserId: clubChoice.clubId });
      }
    }, `${form.name.trim()} saved.`);
  }

  if (isSuper === false) {
    return (
      <div className="page page-photo">
        <h1>Venues</h1>
        <p className="hint">Only Sam (Super) can change venues.</p>
      </div>
    );
  }

  const editor = (
    <div className="comp-form-sub venue-editor">
      {FIELDS.map(([field, label, placeholder]) => (
        <div key={field} className="field">
          <label htmlFor={`venue-${field}`}>{label}</label>
          <input
            id={`venue-${field}`}
            type={field === "map_url" ? "url" : "text"}
            placeholder={placeholder}
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          />
        </div>
      ))}
      <label className="comp-form-check">
        <input
          type="checkbox"
          checked={clubChoice.on}
          onChange={(e) => {
            const on = e.target.checked;
            // A club with the same name is most likely this venue's club
            const match = clubList.find(
              (o) => !o.venue_id && o.name.trim().toLowerCase() === form.name.trim().toLowerCase()
            );
            setClubChoice({ on, clubId: match?.id ?? "new", shortName: match?.short_name ?? form.name.trim() });
          }}
        />
        This venue is also a club
      </label>
      {clubChoice.on && (
        <div className="comp-form-sub">
          <div className="field">
            <label htmlFor="venue-club">Which club?</label>
            <select
              id="venue-club"
              value={clubChoice.clubId}
              onChange={(e) => setClubChoice({ ...clubChoice, clubId: e.target.value })}
            >
              {clubList
                .filter((o) => !o.venue_id || o.venue_id === editing)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              <option value="new">+ A new club: {form.name.trim() || "this venue"}</option>
            </select>
          </div>
          {clubChoice.clubId === "new" && (
            <div className="field">
              <label htmlFor="venue-club-short">Short name (shown on its competitions)</label>
              <input
                id="venue-club-short"
                placeholder="Marton"
                value={clubChoice.shortName}
                onChange={(e) => setClubChoice({ ...clubChoice, shortName: e.target.value })}
              />
            </div>
          )}
          <p className="hint">It shows on the Clubs page, with the competitions played here.</p>
        </div>
      )}
      <p className="hint">
        The maps link is for the exact spot if searching the address doesn&rsquo;t find it: in Google Maps, find the
        green, tap Share, copy the link and paste it here.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="person-check-actions">
        <button type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save venue"}
        </button>
        <button type="button" className="link-button" onClick={() => setEditing(null)}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="page page-photo">
      <div className="comp-list-head">
        <h1>Venues</h1>
        {editing !== "new" && (
          <button type="button" onClick={() => open(null)}>
            Add a venue
          </button>
        )}
      </div>
      <p className="hint">
        Where competitions are played. Pick one in a competition&rsquo;s settings, or for a single session on its page.
        Correcting a venue changes it everywhere it&rsquo;s used.
      </p>
      {message && !error && <p className="hint">{message}</p>}
      {error && editing === null && <p className="error">{error}</p>}

      {editing === "new" && <div className="card">{editor}</div>}

      <div className="card comp-list">
        {venues === null && <p className="hint">Loading&hellip;</p>}
        {venues?.length === 0 && <p className="hint">No venues yet - add the first one.</p>}
        {venues?.map((v) =>
          editing === v.id ? (
            <div key={v.id} className="venue-row-editing">
              {editor}
            </div>
          ) : (
            <div key={v.id} className="comp-list-row">
              <span className="comp-list-main">
                <strong>{v.name}</strong>
                <span className="hint">
                  {[v.address, v.postcode].filter(Boolean).join(" ") || "No address yet"}
                  {(used.get(v.id) ?? 0) > 0 ? ` · used by ${used.get(v.id)}` : " · not used yet"}
                  {clubList.some((o) => o.venue_id === v.id) ? ` · Club: ${clubList.find((o) => o.venue_id === v.id)!.short_name}` : ""}
                </span>
              </span>
              <span className="entries-actions">
                <a href={directionsUrl(v)} target="_blank" rel="noopener noreferrer" className="link-button">
                  Directions
                </a>
                <button type="button" className="link-button" onClick={() => open(v)}>
                  Change
                </button>
                {(used.get(v.id) ?? 0) === 0 && (
                  <button
                    type="button"
                    className="link-button comp-form-remove"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Remove ${v.name}?`)) run(() => deleteVenue(v.id), `${v.name} removed.`);
                    }}
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
