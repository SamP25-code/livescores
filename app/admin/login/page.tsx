"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isNameLogin, loginEmailFor } from "@/lib/loginName";

export default function LoginPage() {
  const router = useRouter();
  // A full name or an email address - see lib/loginName.ts.
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "forgot">("sign-in");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    document.title = mode === "forgot" ? "Reset password · Penwortham Singles" : "Sign in · Penwortham Singles";
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const loginEmail = loginEmailFor(login);
    if (!loginEmail) {
      setError("Enter your full name or email address.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setLoading(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? isNameLogin(login)
            ? "That name and password don't match. Check you've typed your full name as the admin set it up."
            : "That email and password don't match."
          : error.message
      );
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
      <div className="page page-photo" style={{ maxWidth: 360 }}>
        <Link href="/" className="page-back-link">
          <span aria-hidden="true">&lsaquo;</span> Back to results
        </Link>
        <h1>Reset password</h1>
        <div className="card">
          {resetSent ? (
            <p className="hint">
              If an account exists for {email}, a password reset link has been sent. Check your inbox.
            </p>
          ) : (
            <form onSubmit={handleReset}>
              <p className="hint" style={{ marginTop: 0 }}>
                Sign in with your name rather than an email? There&rsquo;s no inbox to send a link to, so ask the
                club admin to set you a new password.
              </p>
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
      </div>
    );
  }

  return (
    <div className="page page-photo" style={{ maxWidth: 360 }}>
      <Link href="/" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> Back to results
      </Link>
      <h1>Admin sign in</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login">Full name or email</label>
            <input
              id="login"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Full Name"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
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
              // Carry a typed email address over to the reset form.
              setEmail(isNameLogin(login) ? "" : login.trim());
            }}
          >
            Forgot password?
          </button>
        </p>
      </div>
    </div>
  );
}
