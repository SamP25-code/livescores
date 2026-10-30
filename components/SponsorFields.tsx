"use client";

import { useState } from "react";
import { uploadSponsorLogo, type SponsorInput } from "@/lib/competitionsApi";
import { errorMessage } from "@/lib/errors";

export const EMPTY_SPONSOR: SponsorInput = { name: "", url: "", logo_url: null };

// The sponsor rows in a set-up form (a competition's or an event's): name,
// website and logo for each, in the order shown. Logos upload straight away
// (so they can be seen) and are saved against the sponsor with the rest of
// the form.
export default function SponsorFields({
  id,
  sponsors,
  onChange,
  onError,
}: {
  id: string;
  sponsors: SponsorInput[];
  onChange: (sponsors: SponsorInput[]) => void;
  onError: (message: string | null) => void;
}) {
  const [uploading, setUploading] = useState<number | null>(null);

  function setSponsor(i: number, field: keyof SponsorInput, value: string | null) {
    onChange(sponsors.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
  }

  async function chooseLogo(i: number, file: File | undefined) {
    if (!file) return;
    onError(null);
    setUploading(i);
    try {
      setSponsor(i, "logo_url", await uploadSponsorLogo(file));
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="comp-form-sponsors">
      <span className="comp-form-sponsors-title">Sponsors (optional)</span>
      {sponsors.map((sponsor, i) => (
        <div key={i} className="comp-form-sponsor">
          <div className="field">
            <label htmlFor={`${id}-${i}`}>{sponsors.length > 1 ? `Sponsor ${i + 1}` : "Sponsor"}</label>
            <input id={`${id}-${i}`} value={sponsor.name} onChange={(e) => setSponsor(i, "name", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-url-${i}`}>Website</label>
            <input
              id={`${id}-url-${i}`}
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
              onClick={() => onChange(sponsors.filter((_, j) => j !== i))}
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
      <button type="button" className="link-button" onClick={() => onChange([...sponsors, EMPTY_SPONSOR])}>
        + Add another sponsor
      </button>
    </div>
  );
}
