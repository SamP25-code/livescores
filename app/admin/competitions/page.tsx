"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIsSuper } from "@/lib/auth";
import { listCompetitions, type CompetitionWithSeries } from "@/lib/competitionsApi";
import { settingsSummary } from "@/lib/competitionSetup";
import { errorMessage } from "@/lib/errors";

const STATUS_LABEL = { planned: "Planned", active: "Active", archived: "Archived" } as const;

// Every competition set up so far, by year. Super only.
export default function CompetitionsPage() {
  const isSuper = useIsSuper();
  const [competitions, setCompetitions] = useState<CompetitionWithSeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Competitions · Admin · Penwortham Singles";
  }, []);

  useEffect(() => {
    if (!isSuper) return;
    listCompetitions()
      .then(setCompetitions)
      .catch((err) => setError(errorMessage(err)));
  }, [isSuper]);

  if (isSuper === false) {
    return (
      <div className="page page-photo">
        <h1>Competitions</h1>
        <p className="hint">Only Sam (Super) can set up competitions.</p>
      </div>
    );
  }

  const years = [...new Set((competitions ?? []).map((c) => c.year))];

  return (
    <div className="page page-photo">
      <div className="comp-list-head">
        <h1>Competitions</h1>
        <Link href="/admin/competitions/new" className="button">
          New competition
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      {competitions === null && !error && <p className="hint">Loading&hellip;</p>}
      {competitions?.length === 0 && (
        <div className="card">
          <p className="hint" style={{ margin: 0 }}>
            Nothing set up yet. Start with <strong>New competition</strong>.
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
