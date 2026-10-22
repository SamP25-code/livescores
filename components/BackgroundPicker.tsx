"use client";

import { useState } from "react";
import { uploadBackground } from "@/lib/backgrounds";
import { errorMessage } from "@/lib/errors";

// Choosing a background photo: a small preview, Upload / Change and Remove.
// The photo uploads straight away; whoever uses this saves the address.
export default function BackgroundPicker({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await uploadBackground(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field background-picker">
      <span className="person-picker-label">{label}</span>
      <div className="background-picker-row">
        <span
          className="background-picker-preview"
          style={{ backgroundImage: value ? `url("${value}")` : undefined }}
          aria-hidden="true"
        >
          {!value && "None"}
        </span>
        <label htmlFor={id} className="button secondary background-picker-upload">
          {busy ? "Uploading…" : value ? "Change photo" : "Upload a photo"}
        </label>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          disabled={busy}
          onChange={(e) => {
            choose(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {value && (
          <button type="button" className="link-button comp-form-remove" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      <p className="hint">{hint}</p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
