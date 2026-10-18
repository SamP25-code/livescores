"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAnyAdmin, useAccess, visibleCompetition } from "@/lib/access";
import { listCompetitions, type CompetitionWithSeries } from "@/lib/competitionsApi";
import { settingsSummary } from "@/lib/competitionSetup";
import { errorMessage } from "@/lib/errors";

const STATUS_LABEL = { planned: "Planned", active: "Active", archived: "Archived" } as const;

// The competitions set up so far, by year: every one for Super, the ones
// they run for an admin. Only Super sets up new ones.
export default function CompetitionsPage() {
  const access = useAccess();
  const isSuper = Boolean(access?.isSuper);
  const admin = access ? isAnyAdmin(access) : null;
  const [competitions, setCompetitions] = useState<CompetitionWithSeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Competitions · Admin · Penwortham Singles";
  }, []);

  useEffect(() => {
    if (!access || !admin) return;
    listCompetitions()
      .then((all) => setCompetitions(all.filter((c) => visibleCompetition(access, c.id))))
      .catch((err) => setError(errorMessage(err)));
  }, [access, admin]);

  if (admin === false) {
    return (
      <div className="page page-photo">
        <h1>Competitions</h1>
        <p className="hint">Only a competition&rsquo;s admin can open its set-up.</p>
      </div>
    );
  }

  const years = [...new Set((competitions ?? []).map((c) => c.year))];

  return (
    <div className="page page-photo">
      <div className="comp-list-head">
        <h1>Competitions</h1>
        {isSuper && (
          <Link href="/admin/competitions/new" className="button">
            New competition
          </Link>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {competitions === null && !error && <p className="hint">Loading&hellip;</p>}
      {competitions?.length === 0 && (
        <div className="card">
          <p className="hint" style={{ margin: 0 }}>
            {isSuper ? (
              <>
                Nothing set up yet. Start with <strong>New competition</strong>.
              </>
            ) : (
              "You're not running any competitions yet."
            )}
          </p>
        </div>
      )}
      {years.map((year) => (
        <section key={year}>
          <h2 className="comp-list-year">{year}</h2>
          <div className="card comp-list">
            {competitions!
              .filter((c) => c.year === year)
              .map((c) => (
                <Link key={c.id} href={`/admin/competitions/${c.id}`} className="comp-list-row">
                  <span className="comp-list-main">
                    <strong>{c.series.name}</strong>
                    <span className="hint">
                      {c.series.organiser.short_name} · {settingsSummary(c)}
                    </span>
                  </span>
                  <span className={`status-pill comp-status-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
