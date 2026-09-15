"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "forgot">("sign-in");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    document.title = mode === "forgot" ? "Reset password — Bowls Live" : "Sign in — Bowls Live";
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/admin");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

  if (mode === "forgot") {
    return (
      <div className="page" style={{ maxWidth: 360 }}>
        <h1>Reset password</h1>
        {resetSent ? (
          <p className="hint">
            If an account exists for {email}, a password reset link has been sent &mdash; check your inbox.
          </p>
        ) : (
          <form onSubmit={handleReset}>
            <div className="field">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p style={{ marginTop: 14 }}>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode("sign-in");
              setError(null);
              setResetSent(false);
            }}
          >
            Back to sign in
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 360 }}>
      <h1>Admin sign in</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p style={{ marginTop: 14 }}>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode("forgot");
            setError(null);
          }}
        >
          Forgot password?
        </button>
      </p>
    </div>
  );
}
