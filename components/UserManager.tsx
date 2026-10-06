"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AdminUser } from "@/lib/adminUsers";
import type { AdminRole } from "@/lib/auth";

// Calls one of the /api/admin/users routes as the signed-in admin.
async function callApi<T>(path: string, method: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(json.error ?? "Something went wrong. Try again.") as Error & { code?: string };
    error.code = json.code;
    throw error;
  }
  return json as T;
}

type Handover = { name: string; password: string; isNew: boolean };

// Everyone who can sign in, with their role - add, change role, give a new
// password, or remove. Passwords are generated here and shown once so the
// admin can pass them on.
export default function UserManager() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);

  const [login, setLogin] = useState("");
  const [role, setRole] = useState<AdminRole>("scorer");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    try {
      const result = await callApi<{ users: AdminUser[]; callerId: string }>("/api/admin/users", "GET");
      setUsers(result.users);
      setCallerId(result.callerId);
    } catch (err) {
      if ((err as { code?: string }).code === "not_configured") setNotConfigured(true);
      else setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHandover(null);
    setAdding(true);
    try {
      const result = await callApi<{ user: AdminUser; password: string }>("/api/admin/users", "POST", {
        login,
        role,
      });
      setHandover({ name: result.user.name, password: result.password, isNew: true });
      setLogin("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function withBusy(userId: string, action: () => Promise<unknown>) {
    setError(null);
    setBusyId(userId);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function changeRole(user: AdminUser, newRole: AdminRole) {
    withBusy(user.id, () => callApi(`/api/admin/users/${user.id}`, "PATCH", { role: newRole }));
  }

  function newPassword(user: AdminUser) {
    if (!confirm(`Give ${user.name} a new password? Their old one will stop working.`)) return;
    setHandover(null);
    withBusy(user.id, async () => {
      const result = await callApi<{ password: string }>(`/api/admin/users/${user.id}`, "PATCH", {
        newPassword: true,
      });
      setHandover({ name: user.name, password: result.password, isNew: false });
    });
  }

  function remove(user: AdminUser) {
    if (!confirm(`Remove ${user.name}? They won't be able to sign in any more.`)) return;
    withBusy(user.id, () => callApi(`/api/admin/users/${user.id}`, "DELETE"));
  }

  if (notConfigured) {
    return (
      <div className="card">
        <p className="hint" style={{ margin: 0 }}>
          To add and manage users here, the site needs your Supabase service role key. In Vercel, add it under
          Settings &rarr; Environment Variables as <code>SUPABASE_SERVICE_ROLE_KEY</code>, then redeploy.
        </p>
      </div>
    );
  }

  return (
    <>
      {handover && <PasswordHandover handover={handover} onDone={() => setHandover(null)} />}
      {error && <p className="error">{error}</p>}

      <div className="card user-list">
        {users === null && !error && <p className="hint">Loading&hellip;</p>}
        {users?.map((user) => {
          const isYou = user.id === callerId;
          const busy = busyId === user.id;
          return (
            <div key={user.id} className="user-row">
              <div className="user-row-who">
                <span className="user-row-name">
                  <strong>{user.name}</strong>
                  {isYou && <span className="user-you"> (you)</span>}
                  <span className={`user-role user-role-${user.role}`}>
                    {user.role === "scorer" ? "Scorer" : "Admin"}
                  </span>
                </span>
                <span className="hint">
                  {user.email && user.email !== user.name ? `${user.email} · ` : ""}
                  {user.lastSignInAt
                    ? `Last signed in ${new Date(user.lastSignInAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : "Never signed in"}
                </span>
              </div>
              <div className="user-row-actions">
                {!isYou && (
                  <select
                    value={user.role}
                    disabled={busy}
                    onChange={(e) => changeRole(user, e.target.value as AdminRole)}
                    aria-label={`Change ${user.name}'s role`}
                  >
                    <option value="owner">Make admin</option>
                    <option value="scorer">Make scorer</option>
                  </select>
                )}
                <button type="button" className="link-button" disabled={busy} onClick={() => newPassword(user)}>
                  New password
                </button>
                {!isYou && (
                  <button type="button" className="link-button user-remove" disabled={busy} onClick={() => remove(user)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="card">
        <h2>Add someone</h2>
        <div className="field">
          <label htmlFor="new-user-login">Full name</label>
          <input
            id="new-user-login"
            required
            autoCapitalize="words"
            autoComplete="off"
            placeholder="Full Name"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new-user-role">Role</label>
          <select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
            <option value="scorer">Scorer - can score matches once a night&rsquo;s draw is published</option>
            <option value="owner">Admin - can do everything, including adding users</option>
          </select>
        </div>
        <p className="hint">
          A password is made for them when you add them. Pass it on and they sign in with their full name and that
          password.
        </p>
        <button type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add user"}
        </button>
      </form>
    </>
  );
}

// The one time a generated password is shown, with a copy button and a
// ready-to-send message.
function PasswordHandover({ handover, onDone }: { handover: Handover; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = `Penwortham Singles admin login - name: ${handover.name}, password: ${handover.password}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="card password-handover" role="status">
      <strong>
        {handover.isNew ? `${handover.name} has been added.` : `${handover.name} has a new password.`}
      </strong>
      <p className="hint" style={{ margin: "4px 0 10px" }}>
        Pass this on to them now - it won&rsquo;t be shown again.
      </p>
      <div className="password-handover-value">{handover.password}</div>
      <div className="password-handover-actions">
        <button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy name and password"}
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
