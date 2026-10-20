"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pageRoleFor, type Access, visibleCompetition } from "@/lib/access";
import { DRAW_LABEL, cardSummary } from "@/lib/adminHome";
import { longDate } from "@/lib/competitionSetup";
import { errorMessage } from "@/lib/errors";
import { loadPublicCompetitions } from "@/lib/publicData";
import {
  STATUS_LABEL,
  formatLine,
  publicStatus,
  sessionTimes,
  sessionTitle,
  sortForList,
  todayIso,
  type PublicCompetition,
} from "@/lib/publicCompetitions";

// The admin home: one card per competition this login runs or scores, saying
// what's next and with a button for the job at hand - enter players, make
// the draw, score.
export default function YourCompetitions({ access }: { access: Access }) {
  const [all, setAll] = useState<PublicCompetition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const comps = await loadPublicCompetitions();
        if (!cancelled) setAll(comps);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    }
    load();
    // Fresh again when they come back to the page
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const mine = sortForList((all ?? []).filter((c) => visibleCompetition(access, c.id)), today);
  // Finished ones go to the bottom, out of the way
  const current = mine.filter((c) => publicStatus(c, today) !== "finished");
  const finished = mine.filter((c) => publicStatus(c, today) === "finished");

  return (
    <>
      <div className="comp-list-head">
        <h1>Your competitions</h1>
        {access.isSuper && (
          <Link href="/admin/competitions/new" className="button">
            New competition
          </Link>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {all === null && !error && <p className="hint">Loading&hellip;</p>}
      {all !== null && mine.length === 0 && (
        <p className="empty">
          {access.isSuper
            ? "Nothing set up yet - start with New competition."
            : "You're not assigned to a competition yet - ask its organiser to add you."}
        </p>
      )}

      <div className="admin-cards">
        {current.map((c) => (
          <CompetitionCard key={c.id} competition={c} access={access} today={today} />
        ))}
      </div>

      {finished.length > 0 && (
        <>
          <h2 className="admin-cards-finished">Finished</h2>
          <div className="card comp-list">
            {finished.map((c) => (
              <Link key={c.id} href={`/admin/competitions/${c.id}`} className="comp-list-row">
                <span className="comp-list-main">
                  <strong>
                    {c.name} {c.year}
                  </strong>
                  <span className="hint">{c.champion ? `Champion ${c.champion.name}` : formatLine(c)}</span>
                </span>
                <span className="comp-list-open">Open ›</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function CompetitionCard({ competition: c, access, today }: { competition: PublicCompetition; access: Access; today: string }) {
  const role = pageRoleFor(access, c.id);
  const runs = role === "owner";
  const status = publicStatus(c, today);
  const s = cardSummary(c, today);
  const pairs = c.team_size === 2;
  const sessionHref = s.focus ? `/admin/night/${s.focus.id}` : null;

  return (
    <article className={`card admin-card ${s.live ? "admin-card-live" : ""}`}>
      <div className="admin-card-top">
        <h2 className="admin-card-name">
          {c.name} {c.year}
        </h2>
        <span className={`comp-pill comp-pill-${status}`}>
          {status === "live" && <span className="live-dot" />}
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="admin-card-line">{formatLine(c)}</p>

      <dl className="admin-card-facts">
        <div>
          <dt>{s.live ? "Now" : "Next"}</dt>
          <dd>
            {s.focus ? (
              <>
                {s.live ? (
                  <>
                    {sessionTitle(s.focus)} &middot; {s.focus.liveCount} match{s.focus.liveCount === 1 ? "" : "es"} live
                  </>
                ) : (
                  <>
                    {s.focus.date ? longDate(s.focus.date) : "Date to be confirmed"} &middot; {sessionTitle(s.focus)}
                    {sessionTimes(s.focus) ? ` · ${sessionTimes(s.focus)}` : ""}
                  </>
                )}
              </>
            ) : c.sessions.some((x) => x.date) ? (
              "All played"
            ) : (
              "Dates to be confirmed"
            )}
          </dd>
        </div>
        <div>
          <dt>Entries</dt>
          <dd>
            {s.entered}
            {s.capacity ? ` of ${s.capacity}` : ""} {pairs ? "pairs" : "players"}
          </dd>
        </div>
        {s.drawState && (
          <div>
            <dt>Draw</dt>
            <dd className={`admin-card-draw admin-card-draw-${s.drawState}`}>{DRAW_LABEL[s.drawState]}</dd>
          </div>
        )}
      </dl>

      <div className="admin-card-actions">
        {/* The job at hand first */}
        {sessionHref && (s.live || s.drawState === "published") && (
          <Link href={sessionHref} className="button">
            {s.live ? "Score now" : "Open the draw"}
          </Link>
        )}
        {runs && sessionHref && s.drawState === "not_made" && (
          <Link href={sessionHref} className="button">
            Make the draw
          </Link>
        )}
        {runs && sessionHref && s.drawState === "made_hidden" && (
          <Link href={sessionHref} className="button">
            Check and publish the draw
          </Link>
        )}
        {runs && (
          <Link href={`/admin/competitions/${c.id}#entries`} className="button secondary">
            Enter players
          </Link>
        )}
        {runs && (
          <Link href={`/admin/competitions/${c.id}`} className="link-button admin-card-more">
            Sessions and settings ›
          </Link>
        )}
      </div>
      {!runs && !s.live && s.drawState !== "published" && (
        <p className="hint">You can score once the draw has been published.</p>
      )}
    </article>
  );
}
