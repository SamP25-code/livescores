"use client";

import { useEffect, useState } from "react";
import { SITE_NAME } from "@/lib/site";
import { newPasswordProblem, saveOwnPassword } from "@/lib/choosePassword";
import { errorMessage } from "@/lib/errors";

export default function AdminSettingsPage() {
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
    </div>
  );
}
