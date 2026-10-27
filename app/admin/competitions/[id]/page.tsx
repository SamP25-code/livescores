"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { pageRoleFor, useAccess } from "@/lib/access";
import { deleteCompetition, getCompetition, type CompetitionWithSeries } from "@/lib/competitionsApi";
import { longDate, settingsSummary } from "@/lib/competitionSetup";
import { postponedLabel } from "@/lib/venues";
import { errorMessage } from "@/lib/errors";
import CompetitionForm from "@/components/CompetitionForm";
import EntriesManager from "@/components/EntriesManager";
import UserManager from "@/components/UserManager";
import QualifyingManager from "@/components/QualifyingManager";
import PastWinners from "@/components/PastWinners";
import { sessionTimes, sessionTitle as publicSessionTitle } from "@/lib/publicCompetitions";
import type { Night } from "@/lib/types";
import { SITE_NAME } from "@/lib/site";
import { supabase } from "@/lib/supabaseClient";
import { setupChecklist } from "@/lib/setupChecklist";
import { entryCapacity } from "@/lib/people";

const STATUS_LABEL = { planned: "Coming up", active: "On now", archived: "Finished" } as const;

// "A", "A and B", "A, B and C"
function sponsorList(names: string[]): string {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Named as everywhere else on the site: "Session 2", "Finals Day", "One day", "Final"
function sessionTitle(night: Night): string {
  return publicSessionTitle({ kind: night.kind, session_number: night.session_number ?? null });
}

type Tab = "overview" | "entries" | "qualifying" | "people" | "past" | "settings";

const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  entries: "Entries",
  qualifying: "Qualifying",
  people: "Admins & scorers",
  past: "Past winners",
  settings: "Settings",
};

// The tab in the address (#entries), so other pages can link straight to it
function tabFromHash(): Tab {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace("#", "");
  return (["overview", "entries", "qualifying", "people", "past", "settings"] as Tab[]).includes(hash as Tab) ? (hash as Tab) : "overview";
}

// One competition, in tabs: Overview (settings at a glance and its sessions,
// each opening the session's page), Entries, Admins & scorers, and - for
// Super - Settings. Open to Super and the competition's admins.
export default function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const access = useAccess();
  const isSuper = Boolean(access?.isSuper);
  const canRun = access ? pageRoleFor(access, id) === "owner" : null;
  const [data, setData] = useState<{ competition: CompetitionWithSeries; sessions: Night[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  // For the checklist: entries, admins and qualifying places
  const [counts, setCounts] = useState<{ entered: number; admins: number; places: number } | null>(null);

  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function show(next: Tab) {
    setTab(next);
    history.replaceState(null, "", next === "overview" ? window.location.pathname : `#${next}`);
  }

  async function load() {
    try {
      setData(await getCompetition(id));
      const [entered, admins, places] = await Promise.all([
        supabase.from("entries").select("id", { count: "exact", head: true }).eq("competition_id", id).eq("status", "entered"),
        supabase.from("assignments").select("user_id", { count: "exact", head: true }).eq("competition_id", id).eq("role", "admin"),
        supabase.from("qualifying_places").select("id", { count: "exact", head: true }).eq("competition_id", id),
      ]);
      setCounts({ entered: entered.count ?? 0, admins: admins.count ?? 0, places: places.count ?? 0 });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    if (canRun) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canRun]);

  useEffect(() => {
    document.title = data
      ? `${data.competition.series.name} ${data.competition.year} · Admin · ${SITE_NAME}`
      : `Competition · Admin · ${SITE_NAME}`;
  }, [data]);

  if (canRun === false) {
    return (
      <div className="page page-photo">
        <p className="hint">Only this competition&rsquo;s admins can open it.</p>
      </div>
    );
  }

  const c = data?.competition;

  return (
    <div className="page page-photo">
      <Link href="/admin" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> Your competitions
      </Link>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="quiet-line">Loading&hellip;</p>}

      {c && (
        <>
          <h1>
            {c.series.name} {c.year}
          </h1>
          <div className="comp-tabs" role="tablist" aria-label="Competition">
            {(
              [
                "overview",
                "entries",
                ...(c.entry_method === "qualification" ? ["qualifying"] : []),
                "people",
                ...(isSuper ? ["past", "settings"] : []),
              ] as Tab[]
            ).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`comp-tab ${tab === t ? "comp-tab-on" : ""}`}
                onClick={() => show(t)}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <>
              {counts && (
                <div className="card setup-checklist">
                  <h2>Set-up</h2>
                  {setupChecklist({
                    sessions: data.sessions,
                    venueId: c.venue_id,
                    movesBetweenClubs: c.series.organiser.kind === "county",
                    entered: counts.entered,
                    capacity: entryCapacity(c),
                    admins: counts.admins,
                    qualification: c.entry_method === "qualification",
                    qualifyingPlaces: counts.places,
                  }).map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`setup-item ${item.done ? "setup-item-done" : ""}`}
                      onClick={() => {
                        if (item.tab === "settings" && !isSuper) return;
                        show(item.tab);
                        if (item.tab === "settings") setEditing(true);
                      }}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                      <span className="setup-item-state">{item.done ? "Done" : "To do"}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="card comp-summary">
                <p>
                  <span className={`status-pill status-pill-${c.status}`}>{STATUS_LABEL[c.status]}</span>{" "}
                  Run by {c.series.organiser.short_name}
                  {c.sponsors.length > 0 ? ` · Sponsored by ${sponsorList(c.sponsors.map((s) => s.name))}` : ""}
                </p>
                <p className="hint">{settingsSummary(c)}</p>
                <p className="hint">
                  Web address: /{c.series.slug} (latest year) · /{c.series.slug}-{c.year}
                </p>
                {c.structure_locked && <p className="hint">The format is locked - a draw has been made.</p>}
              </div>

              {c.series.organiser.kind === "event" && isSuper && (
                <div className="card event-admin-links">
                  <span>
                    Part of the <strong>{c.series.organiser.name}</strong>
                  </span>
                  <span className="person-check-actions">
                    <Link href={`/admin/competitions/new?event=${c.series.organiser.id}`} className="button">
                      + Add another competition to the {c.series.organiser.name}
                    </Link>
                    <Link href={`/admin/events/${c.series.organiser.id}`} className="link-button">
                      Its page and posts
                    </Link>
                  </span>
                </div>
              )}

              <h2>Sessions</h2>
              <div className="card comp-list">
                {data.sessions.length === 0 && <p className="hint">No sessions yet - save the settings to create them.</p>}
                {data.sessions.map((s) => (
                  <Link key={s.id} href={`/admin/night/${s.id}`} className="comp-list-row">
                    <span className="comp-list-main">
                      <strong>{sessionTitle(s)}</strong>
                      <span className="hint">
                        {postponedLabel(s) ??
                          `${s.date ? longDate(s.date) : "Date to be confirmed"}${
                            sessionTimes(s) ? ` · ${sessionTimes(s)}` : ""
                          }`}
                      </span>
                    </span>
                    <span className="comp-list-open">Open</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {tab === "entries" && <EntriesManager competition={c} sessions={data.sessions} />}

          {tab === "qualifying" && c.entry_method === "qualification" && <QualifyingManager competitionId={c.id} />}

          {tab === "people" && (
            <>
              <p className="hint">
                Who runs and scores this competition. Someone new gets a login and a password to pass on; they choose
                their own when they first sign in.
              </p>
              <UserManager competitionId={c.id} />
            </>
          )}

          {tab === "past" && isSuper && (
            <PastWinners seriesId={c.series.id} seriesName={c.series.name} doubles={c.team_size === 2} />
          )}

          {tab === "settings" && isSuper && (
            <>
              {saved && !editing && <p className="hint">Changes saved.</p>}
              {!editing ? (
                <>
                  <button type="button" className="secondary" onClick={() => setEditing(true)}>
                    Change settings or dates
                  </button>
                  {/* Set up by mistake: take it away again, while nothing's happened in it */}
                  <div className="card admin-remove">
                    <p className="hint" style={{ marginTop: 0 }}>
                      Set up by mistake? It can be removed while it has no entries or scores.
                    </p>
                    {removeError && <p className="error">{removeError}</p>}
                    <button
                      type="button"
                      className="danger"
                      onClick={async () => {
                        if (!confirm(`Remove ${c.series.name} ${c.year}? This can't be undone.`)) return;
                        setRemoveError(null);
                        try {
                          await deleteCompetition(c);
                          window.location.href = "/admin/competitions";
                        } catch (err) {
                          setRemoveError(errorMessage(err));
                        }
                      }}
                    >
                      Remove this competition
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <CompetitionForm
                    existing={data}
                    onSaved={async () => {
                      setEditing(false);
                      setSaved(true);
                      await load();
                    }}
                  />
                  <button type="button" className="link-button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
