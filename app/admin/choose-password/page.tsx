"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { newPasswordProblem, saveOwnPassword } from "@/lib/choosePassword";
import { errorMessage } from "@/lib/errors";
import { SITE_NAME } from "@/lib/site";

// The first sign-in with a password someone else was given: choose your own
// before anything else. Shown on its own, without the admin menu.
export default function ChoosePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = `Choose your password · ${SITE_NAME}`;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = newPasswordProblem(password, again);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveOwnPassword(password);
      router.replace("/admin");
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="page page-photo" style={{ maxWidth: 420 }}>
      <h1>Choose your password</h1>
      <form onSubmit={handleSubmit} className="card">
        <p style={{ marginTop: 0 }}>
          Welcome! You signed in with a password you were given. Choose one of your own - you&rsquo;ll use it from
          now on.
        </p>
        <div className="field">
          <label htmlFor="choose-password">New password</label>
          <input
            id="choose-password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="hint">At least 8 characters.</p>
        </div>
        <div className="field">
          <label htmlFor="choose-password-again">New password again</label>
          <input
            id="choose-password-again"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}
