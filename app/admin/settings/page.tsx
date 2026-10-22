"use client";

import { useEffect, useState } from "react";
import { SITE_NAME } from "@/lib/site";
import { newPasswordProblem, saveOwnPassword } from "@/lib/choosePassword";
import { errorMessage } from "@/lib/errors";
import { useIsSuper } from "@/lib/auth";
import { loadSiteBackground, saveSiteBackground } from "@/lib/backgrounds";
import BackgroundPicker from "@/components/BackgroundPicker";

export default function AdminSettingsPage() {
  const isSuper = useIsSuper();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.title = `Settings · Admin · ${SITE_NAME}`;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const problem = newPasswordProblem(password, confirmPassword);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await saveOwnPassword(password);
    } catch (err) {
      setSaving(false);
      setError(errorMessage(err));
      return;
    }
    setSaving(false);
    setPassword("");
    setConfirmPassword("");
    setSaved(true);
  }

  return (
    <div className="page page-photo">
      <h1>Settings</h1>
      <form onSubmit={handleSubmit} className="card">
        <h2>Change your password</h2>
        <p className="hint">Swap the password you were given for one you&rsquo;ll remember.</p>
        <div className="field">
          <label htmlFor="settings-password">New password</label>
          <input
            id="settings-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="settings-password-confirm">New password again</label>
          <input
            id="settings-password-confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        {saved && <p className="hint">Password changed.</p>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Change password"}
        </button>
      </form>

      {isSuper && <SiteBackgroundSetting />}
    </div>
  );
}

// Super: the photo behind every page that hasn't its own
function SiteBackgroundSetting() {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSiteBackground()
      .then(setUrl)
      .catch(() => setUrl(null));
  }, []);

  async function change(next: string | null) {
    setError(null);
    setMessage(null);
    try {
      await saveSiteBackground(next);
      setUrl(next);
      document.documentElement.style[next ? "setProperty" : "removeProperty"]("--site-background", next ? `url("${next}")` : "");
      setMessage(next ? "Background changed." : "Back to the built-in photo.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <h2>Site background</h2>
      {url === undefined ? (
        <p className="hint">Loading&hellip;</p>
      ) : (
        <BackgroundPicker
          id="site-background"
          label="The photo behind every page"
          hint="Competitions and events with their own background show theirs instead. A landscape photo works best."
          value={url}
          onChange={change}
        />
      )}
      {message && !error && <p className="hint">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
