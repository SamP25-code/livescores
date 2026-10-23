"use client";

import { useEffect, useState } from "react";
import { useIsSuper } from "@/lib/auth";
import { deleteClub, listClubsWithGreens, saveClub, venueUsage, type ClubWithGreen } from "@/lib/competitionsApi";
import { errorMessage } from "@/lib/errors";
import { SITE_NAME } from "@/lib/site";
import { checkMapUrl, directionsUrl } from "@/lib/venues";

type Form = { name: string; short_name: string; address: string; postcode: string; notes: string; map_url: string };
const EMPTY: Form = { name: "", short_name: "", address: "", postcode: "", notes: "", map_url: "" };

const FIELDS: [keyof Form, string, string][] = [
  ["name", "Club name", "Penwortham Sports & Social Club"],
  ["short_name", "Short name (shown on its competitions)", "Penwortham"],
  ["address", "Address", "Hill Road, Penwortham"],
  ["postcode", "Postcode", "PR1 9XH"],
  ["notes", "Notes for spectators (optional)", "Parking on site. Bar open, seating available"],
  ["map_url", "Google Maps link (optional)", "https://maps.app.goo.gl/..."],
];

// Every club, and its green: the address, postcode and map link behind each
// competition's directions (Super). A competition picks where it's played
// from this list, and so can a single session played somewhere else.
// Correcting a club here changes it everywhere it's used.
export default function ClubsAdminPage() {
  const isSuper = useIsSuper();
  const [clubs, setClubs] = useState<ClubWithGreen[] | null>(null);
  const [used, setUsed] = useState<Map<string, number>>(new Map());
  const [editing, setEditing] = useState<string | null>(null); // club id, or "new"
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      const [list, usage] = await Promise.all([listClubsWithGreens(), venueUsage()]);
      setClubs(list);
      setUsed(usage);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    document.title = `Clubs · Admin · ${SITE_NAME}`;
  }, []);

  useEffect(() => {
    if (isSuper) load();
  }, [isSuper]);

  function open(c: ClubWithGreen | null) {
    setError(null);
    setMessage(null);
    setEditing(c ? c.id : "new");
    setForm(
      c
        ? {
            name: c.name,
            short_name: c.short_name,
            address: c.venue?.address ?? "",
            postcode: c.venue?.postcode ?? "",
            notes: c.venue?.notes ?? "",
            map_url: c.venue?.map_url ?? "",
          }
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
      const map = checkMapUrl(form.map_url);
      if (map.problem) throw new Error(map.problem);
      if (!form.name.trim()) throw new Error("Enter the club's name.");
      await saveClub(editing === "new" ? null : clubs?.find((c) => c.id === editing) ?? null, {
        name: form.name.trim(),
        short_name: form.short_name.trim() || form.name.trim(),
        address: form.address.trim() || null,
        postcode: form.postcode.trim() || null,
        notes: form.notes.trim() || null,
        map_url: map.url,
      });
    }, `${form.name.trim()} saved.`);
  }

  if (isSuper === false) {
    return (
      <div className="page page-photo">
        <h1>Clubs</h1>
        <p className="hint">Only Sam (Super) can change clubs.</p>
      </div>
    );
  }

  const editor = (
    <div className="comp-form-sub venue-editor">
      {FIELDS.map(([field, label, placeholder]) => (
        <div key={field} className="field">
          <label htmlFor={`club-${field}`}>{label}</label>
          <input
            id={`club-${field}`}
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
          {busy ? "Saving…" : "Save club"}
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
        <h1>Clubs</h1>
        {editing !== "new" && (
          <button type="button" onClick={() => open(null)}>
            + Add a club
          </button>
        )}
      </div>
      <p className="hint">
        Every club and its green. A competition picks where it&rsquo;s played from here - and so can a single session
        played somewhere else. Correcting a club changes it everywhere it&rsquo;s used.
      </p>
      {message && !error && <p className="hint">{message}</p>}
      {error && editing === null && <p className="error">{error}</p>}

      {editing === "new" && (
        <div className="card venue-admin-card venue-admin-editing">
          <p className="venue-admin-editing-title">A new club</p>
          {editor}
        </div>
      )}

      {/* Each club its own card - the one being changed outlined in green */}
      <div className="venue-cards">
        {clubs === null && <p className="quiet-line">Loading&hellip;</p>}
        {clubs?.length === 0 && <p className="quiet-line">No clubs yet - add the first one.</p>}
        {clubs?.map((c) => {
          const uses = c.venue_id ? (used.get(c.venue_id) ?? 0) : 0;
          return editing === c.id ? (
            <div key={c.id} className="card venue-admin-card venue-admin-editing">
              <p className="venue-admin-editing-title">Changing {c.name}</p>
              {editor}
            </div>
          ) : (
            <div key={c.id} className="card venue-admin-card">
              <span className="comp-list-main">
                <strong>{c.name}</strong>
                <span className="hint">
                  {[c.venue?.address, c.venue?.postcode].filter(Boolean).join(" ") || "No address yet"}
                  {uses > 0 ? ` · played at by ${uses}` : ""}
                </span>
              </span>
              <span className="entries-actions">
                {c.venue && (c.venue.address || c.venue.postcode || c.venue.map_url) && (
                  <a href={directionsUrl(c.venue)} target="_blank" rel="noopener noreferrer" className="link-button">
                    Directions
                  </a>
                )}
                <button type="button" className="link-button" onClick={() => open(c)}>
                  Change
                </button>
                {uses === 0 && (
                  <button
                    type="button"
                    className="link-button comp-form-remove"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Remove ${c.name}?`)) run(() => deleteClub(c), `${c.name} removed.`);
                    }}
                  >
                    Remove
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
