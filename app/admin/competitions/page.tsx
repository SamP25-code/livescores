"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAnyAdmin, useAccess, visibleCompetition } from "@/lib/access";
import { listCompetitions, type CompetitionWithSeries } from "@/lib/competitionsApi";
import { settingsSummary } from "@/lib/competitionSetup";
import { errorMessage } from "@/lib/errors";
import { SITE_NAME } from "@/lib/site";

const STATUS_LABEL = { planned: "Coming up", active: "On now", archived: "Finished" } as const;

// The competitions set up so far, by year: every one for Super, the ones
// they run for an admin. Only Super sets up new ones.
const KIND_ORDER = { club: 0, county: 1, event: 2 } as const;

export default function CompetitionsPage() {
  const access = useAccess();
  const isSuper = Boolean(access?.isSuper);
  const admin = access ? isAnyAdmin(access) : null;
  const [competitions, setCompetitions] = useState<CompetitionWithSeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Competitions · Admin · ${SITE_NAME}`;
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
            + New competition
          </Link>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {competitions === null && !error && <p className="quiet-line">Loading&hellip;</p>}
      {competitions?.length === 0 && (
        <div className="card">
          <p className="hint hint-flush">
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
      {years.map((year) => {
        // Grouped by who runs them: clubs A to Z, then the county, then
        // events (the Blackpool Masters' competitions together)
        const thisYear = competitions!.filter((c) => c.year === year);
        const groups = [...new Map(thisYear.map((c) => [c.series.organiser.id, c.series.organiser])).values()].sort(
          (a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
        );
        return (
          <section key={year}>
            <h2 className="comp-list-year">{year}</h2>
            {groups.map((o) => (
              <div key={o.id} className="comp-group">
                <div className="comp-group-head">
                  <h3>{o.name}</h3>
                  {o.kind === "event" && isSuper && (
                    <Link href={`/admin/events/${o.id}`} className="comp-group-link">
                      Event page and posts
                    </Link>
                  )}
                </div>
                <div className="card comp-list">
                  {thisYear
                    .filter((c) => c.series.organiser.id === o.id)
                    .map((c) => (
                      <Link key={c.id} href={`/admin/competitions/${c.id}`} className="comp-list-row">
                        <span className="comp-list-main">
                          <strong>{c.series.name}</strong>
                          <span className="hint">{settingsSummary(c)}</span>
                        </span>
                        <span className={`status-pill status-pill-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
