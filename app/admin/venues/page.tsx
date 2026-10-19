"use client";

import { useEffect, useState } from "react";
import { useIsSuper } from "@/lib/auth";
import { createVenue, deleteVenue, listVenues, updateVenue, venueUsage, type VenueInput } from "@/lib/competitionsApi";
import { errorMessage } from "@/lib/errors";
import { SITE_NAME } from "@/lib/site";
import { checkMapUrl, directionsUrl } from "@/lib/venues";
import type { Venue } from "@/lib/types";

type Form = { name: string; address: string; postcode: string; notes: string; map_url: string };
const EMPTY: Form = { name: "", address: "", postcode: "", notes: "", map_url: "" };

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      const [list, usage] = await Promise.all([listVenues(), venueUsage()]);
      setVenues(list);
      setUsed(usage);
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
      if (editing === "new") await createVenue(input);
      else if (editing) await updateVenue(editing, input);
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
