"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useIsSuper } from "@/lib/auth";
import { getCompetition, type CompetitionWithSeries } from "@/lib/competitionsApi";
import { longDate, settingsSummary } from "@/lib/competitionSetup";
import { errorMessage } from "@/lib/errors";
import CompetitionForm from "@/components/CompetitionForm";
import type { Night } from "@/lib/types";

const STATUS_LABEL = { planned: "Planned", active: "Active", archived: "Archived" } as const;

function sessionTitle(night: Night): string {
  if (night.kind === "qualifier") return `Qualifying night ${night.session_number}`;
  if (night.kind === "finals") return "Finals Day";
  if (night.kind === "final") return "The final";
  return "The day";
}

// One competition: its settings at a glance, its sessions (each opens the
// existing night admin page), and the settings form to change them.
export default function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isSuper = useIsSuper();
  const [data, setData] = useState<{ competition: CompetitionWithSeries; sessions: Night[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      setData(await getCompetition(id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    if (isSuper) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSuper]);

  useEffect(() => {
    document.title = data
      ? `${data.competition.series.name} ${data.competition.year} · Admin · Penwortham Singles`
      : "Competition · Admin · Penwortham Singles";
  }, [data]);

  if (isSuper === false) {
    return (
      <div className="page page-photo">
        <p className="hint">Only Sam (Super) can set up competitions.</p>
      </div>
    );
  }

  const c = data?.competition;

  return (
    <div className="page page-photo">
      <Link href="/admin/competitions" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> Competitions
      </Link>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="hint">Loading&hellip;</p>}

      {c && (
        <>
          <h1>
            {c.series.name} {c.year}
          </h1>
          <div className="card comp-summary">
            <p>
              <span className={`status-pill comp-status-${c.status}`}>{STATUS_LABEL[c.status]}</span>{" "}
              Run by {c.series.organiser.short_name}
              {c.sponsor_name ? ` · Sponsored by ${c.sponsor_name}` : ""}
            </p>
            <p className="hint">{settingsSummary(c)}</p>
            <p className="hint">
              Web address: /{c.series.slug} (latest year) · /{c.series.slug}-{c.year}
            </p>
            {c.structure_locked && <p className="hint">The format is locked - a draw has been made.</p>}
          </div>

          <h2>Sessions</h2>
          <div className="card comp-list">
            {data.sessions.length === 0 && <p className="hint">No sessions yet - save the settings to create them.</p>}
            {data.sessions.map((s) => (
              <Link key={s.id} href={`/admin/night/${s.id}`} className="comp-list-row">
                <span className="comp-list-main">
                  <strong>{sessionTitle(s)}</strong>
                  <span className="hint">
                    {s.date ? longDate(s.date) : "Date to be confirmed"}
                    {s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ""}
                    {s.postponed ? " · Postponed" : ""}
                  </span>
                </span>
                <span className="comp-list-open">Open ›</span>
              </Link>
            ))}
          </div>

          {saved && !editing && <p className="hint">Changes saved.</p>}
          {!editing ? (
            <button type="button" className="secondary" onClick={() => setEditing(true)}>
              Change settings or dates
            </button>
          ) : (
            <>
              <h2>Settings</h2>
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
    </div>
  );
}
