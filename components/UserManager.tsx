"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { forgetAccess } from "@/lib/access";
import { canAssign, canResetPassword, type CompetitionChoice, type StaffUser } from "@/lib/staffUsers";
import { SITE_NAME } from "@/lib/site";
import { startViewingAs } from "@/lib/viewAs";

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
type Role = "admin" | "scorer";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", scorer: "Scorer" };

// Who runs and scores each competition. Super sees everyone and can add
// admins or scorers anywhere; an admin sees the people in their own
// competitions and adds scorers to them. Someone new gets a login with a
// generated password, shown once to pass on; someone with a login already is
// just added to the competition.
export default function UserManager() {
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionChoice[]>([]);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [filter, setFilter] = useState(""); // competition id, or "" for all

  const [login, setLogin] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [role, setRole] = useState<Role>("scorer");
  const [adding, setAdding] = useState(false);
  // "+ Add to a competition" on one person's row
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignComp, setAssignComp] = useState("");
  const [assignRole, setAssignRole] = useState<Role>("admin");

  async function refresh() {
    try {
      const result = await callApi<{
        users: StaffUser[];
        competitions: CompetitionChoice[];
        callerId: string;
        isSuper: boolean;
      }>("/api/admin/users", "GET");
      setUsers(result.users);
      setCompetitions(result.competitions);
      setCallerId(result.callerId);
      setIsSuper(result.isSuper);
    } catch (err) {
      if ((err as { code?: string }).code === "not_configured") setNotConfigured(true);
      else setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const viewer = { id: callerId ?? "", isSuper, adminOf: new Set(competitions.map((c) => c.id)) };
  const titleOf = (id: string) => competitions.find((c) => c.id === id)?.title ?? "Another competition";
  const chosenCompetition = competitionId || filter || competitions[0]?.id || "";

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHandover(null);
    setAdding(true);
    try {
      const result = await callApi<{ user: StaffUser; password: string | null }>("/api/admin/users", "POST", {
        login,
        competitionId: chosenCompetition,
        role: isSuper ? role : "scorer",
      });
      if (result.password) setHandover({ name: result.user.name, password: result.password, isNew: true });
      if (result.user.id === callerId) forgetAccess();
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

  function newPassword(user: StaffUser) {
    if (!confirm(`Give ${user.name} a new password? Their old one will stop working.`)) return;
    setHandover(null);
    withBusy(user.id, async () => {
      const result = await callApi<{ password: string }>(`/api/admin/users/${user.id}`, "PATCH", {
        newPassword: true,
      });
      setHandover({ name: user.name, password: result.password, isNew: false });
    });
  }

  // Competitions this person could still be added to
  function openFor(user: StaffUser): CompetitionChoice[] {
    return competitions.filter((c) => !user.assignments.some((a) => a.competition_id === c.id));
  }

  function startAssign(user: StaffUser) {
    const choices = openFor(user);
    setAssigningId(user.id);
    setAssignComp(choices[0]?.id ?? "");
    setAssignRole(isSuper ? "admin" : "scorer");
    setError(null);
  }

  function assign(user: StaffUser) {
    withBusy(user.id, async () => {
      await callApi("/api/admin/users", "POST", {
        userId: user.id,
        competitionId: assignComp,
        role: isSuper ? assignRole : "scorer",
      });
      if (user.id === callerId) forgetAccess();
      setAssigningId(null);
    });
  }

  function unassign(user: StaffUser, compId: string) {
    if (!confirm(`Take ${user.name} off ${titleOf(compId)}?`)) return;
    withBusy(user.id, () => callApi(`/api/admin/users/${user.id}?competition=${compId}`, "DELETE"));
  }

  function removeLogin(user: StaffUser) {
    if (!confirm(`Remove ${user.name}'s login? They won't be able to sign in any more.`)) return;
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

  const shown = (users ?? []).filter(
    (u) => !filter || u.assignments.some((a) => a.competition_id === filter) || (u.isSuper && isSuper)
  );

  return (
    <>
      {handover && <PasswordHandover handover={handover} onDone={() => setHandover(null)} />}
      {error && <p className="error">{error}</p>}

      {competitions.length > 1 && (
        <div className="field user-filter">
          <label htmlFor="user-filter">Competition</label>
          <select id="user-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{isSuper ? "Everyone" : "All my competitions"}</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="card user-list">
        {users === null && !error && <p className="hint">Loading&hellip;</p>}
        {users !== null && shown.length === 0 && <p className="hint">Nobody assigned yet.</p>}
        {shown.map((user) => {
          const isYou = user.id === callerId;
          const busy = busyId === user.id;
          const assignments = filter ? user.assignments.filter((a) => a.competition_id === filter) : user.assignments;
          return (
            <div key={user.id} className="user-row">
              <div className="user-row-who">
                <span className="user-row-name">
                  <strong>{user.name}</strong>
                  {isYou && <span className="user-you"> (you)</span>}
                  {user.isSuper && <span className="user-role user-role-owner">Super</span>}
                </span>
                <span className="user-assignments">
                  {assignments.map((a) => (
                    <span key={a.competition_id} className={`user-assignment user-assignment-${a.role}`}>
                      {titleOf(a.competition_id)} · {ROLE_LABEL[a.role]}
                      {canAssign(a.competition_id, a.role, viewer) && (
                        <button
                          type="button"
                          className="user-assignment-remove"
                          disabled={busy}
                          aria-label={`Take ${user.name} off ${titleOf(a.competition_id)}`}
                          onClick={() => unassign(user, a.competition_id)}
                        >
                          &times;
                        </button>
                      )}
                    </span>
                  ))}
                  {assignments.length === 0 && !user.isSuper && (
                    <span className="hint">Not assigned to anything</span>
                  )}
                  {!user.isSuper && assigningId !== user.id && openFor(user).length > 0 && (
                    <button type="button" className="link-button user-assign-open" disabled={busy} onClick={() => startAssign(user)}>
                      + Add to a competition
                    </button>
                  )}
                </span>
                {assigningId === user.id && (
                  <span className="user-assign">
                    <select
                      aria-label={`Competition to add ${user.name} to`}
                      value={assignComp}
                      onChange={(e) => setAssignComp(e.target.value)}
                    >
                      {openFor(user).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                    {isSuper && (
                      <select
                        aria-label={`${user.name}'s role`}
                        value={assignRole}
                        onChange={(e) => setAssignRole(e.target.value as Role)}
                      >
                        <option value="admin">Admin</option>
                        <option value="scorer">Scorer</option>
                      </select>
                    )}
                    <button type="button" disabled={busy || !assignComp} onClick={() => assign(user)}>
                      Add
                    </button>
                    <button type="button" className="link-button" onClick={() => setAssigningId(null)}>
                      Cancel
                    </button>
                  </span>
                )}
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
                {isSuper && !isYou && !user.isSuper && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() =>
                      withBusy(user.id, async () => {
                        await startViewingAs(user.id);
                      })
                    }
                  >
                    View as
                  </button>
                )}
                {canResetPassword(user, viewer) && (
                  <button type="button" className="link-button" disabled={busy} onClick={() => newPassword(user)}>
                    New password
                  </button>
                )}
                {isSuper && !isYou && (
                  <button type="button" className="link-button user-remove" disabled={busy} onClick={() => removeLogin(user)}>
                    Remove login
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {competitions.length > 0 && (
        <form onSubmit={handleAdd} className="card">
          <h2>{isSuper ? "Add someone to a competition" : "Add a scorer"}</h2>
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
            <label htmlFor="new-user-competition">Competition</label>
            <select
              id="new-user-competition"
              value={chosenCompetition}
              onChange={(e) => setCompetitionId(e.target.value)}
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          {isSuper && (
            <div className="field">
              <label htmlFor="new-user-role">Role</label>
              <select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="scorer">Scorer - scores matches once the draw is published</option>
                <option value="admin">Admin - runs the competition and adds its scorers</option>
              </select>
            </div>
          )}
          <p className="hint">
            Someone new gets a password when you add them - pass it on and they sign in with their full name and that
            password. Someone who already has a login is just added to this competition.
          </p>
          <button type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      )}
    </>
  );
}

// The one time a generated password is shown, with a copy button and a
// ready-to-send message.
function PasswordHandover({ handover, onDone }: { handover: Handover; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const message = `${SITE_NAME} admin login - name: ${handover.name}, password: ${handover.password}`;

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
        Pass this on to them now - it won&rsquo;t be shown again. When they first sign in with it, they&rsquo;ll
        be asked to choose their own password.
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
