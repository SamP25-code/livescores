"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { settingsSummary } from "@/lib/competitionSetup";
import { loadHonours, loadPublicCompetitions, type HonoursRow } from "@/lib/publicData";
import {
  STATUS_LABEL,
  competitionPath,
  publicStatus,
  resolveCompetition,
  resolveEvent,
  shortDate,
  sessionTitle,
  sessionTimes,
  todayIso,
  type PublicCompetition,
  type PublicSession,
} from "@/lib/publicCompetitions";
import { SITE_NAME } from "@/lib/site";
import { directionsUrl, originalDateLabel, postponedLabel } from "@/lib/venues";
import PlayerName from "@/components/PlayerName";
import { SponsorPanel } from "@/components/Sponsors";
import WhosEntered from "@/components/WhosEntered";
import HowToQualify from "@/components/HowToQualify";
import EventPage from "@/components/event/EventPage";
import type { Venue } from "@/lib/types";
import PublicFooter from "@/components/PublicFooter";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

// One competition: name and year, who runs it and its sponsors, its settings,
// its schedule (each session opens its draw), where it's played, and its
// honours board. /october-singles is always the latest year;
// /october-singles-2026 is that year.
export default function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [all, setAll] = useState<PublicCompetition[] | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [honours, setHonours] = useState<HonoursRow[]>([]);
  const [failed, setFailed] = useState(false);
  const today = todayIso();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const comps = await loadPublicCompetitions();
        if (cancelled) return;
        setAll(comps);
        const c = resolveCompetition(comps, slug);
        if (!c) return;
        const [venueRow, rows] = await Promise.all([
          c.venue_id
            ? supabase.from("venues").select("*").eq("id", c.venue_id).single().then((r) => r.data as Venue | null)
            : Promise.resolve(null),
          loadHonours(c.slug, comps),
        ]);
        if (cancelled) return;
        setVenue(venueRow);
        setHonours(rows);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const c = all ? resolveCompetition(all, slug) : null;

  useEffect(() => {
    document.title = c ? `${c.name} ${c.year} · ${SITE_NAME}` : SITE_NAME;
  }, [c]);

  if (failed) {
    return (
      <Shell>
        <p className="night-header-hint">Having trouble loading this page? Check your connection and try refreshing.</p>
      </Shell>
    );
  }
  if (!all) {
    return (
      <Shell>
        <p className="night-header-hint">Loading&hellip;</p>
      </Shell>
    );
  }
  // An event's address (/blackpool-masters): its own page
  const event = !c ? resolveEvent(all, slug) : null;
  if (event) return <EventPage event={event} all={all} />;

  if (!c) {
    return (
      <Shell>
        <h1 className="comp-page-title">Not found</h1>
        <p className="night-header-hint">There&rsquo;s no competition at this address.</p>
      </Shell>
    );
  }

  const status = publicStatus(c, today);
  const otherYears = all.filter((x) => x.slug === c.slug && x.year !== c.year).sort((a, b) => b.year - a.year);
  const runBy = c.organiser.kind === "event" ? c.organiser.name : c.organiser.short_name;

  return (
    <Shell>
      <header className="comp-page-head">
        <h1 className="comp-page-title">
          {c.name} {c.year}
        </h1>
        <p className="comp-page-by">Run by {runBy}</p>
        <SponsorPanel sponsors={c.sponsors} />
        <div className="comp-page-pills">
          <span className={`comp-pill comp-pill-${status}`}>
            {status === "live" && <span className="live-dot" />}
            {STATUS_LABEL[status]}
          </span>
          {settingsSummary(c)
            .split(" · ")
            .map((p) => (
              <span key={p} className="comp-page-pill">
                {p}
              </span>
            ))}
        </div>
      </header>

      {c.champion && (
        <div className="champion-banner">
          <PlayerName name={c.champion.name} />
          <span className="hint">
            {c.name} {c.year} champion
            {c.champion.runnerUp ? ` · runner-up ${c.champion.runnerUp}` : ""}
          </span>
        </div>
      )}

      <div className="card comp-schedule">
        {c.sessions.length === 0 && <p className="hint">Dates to be confirmed.</p>}
        {c.sessions.map((s) => (
          <ScheduleRow key={s.id} session={s} competition={c} today={today} />
        ))}
      </div>

      {c.entry_method === "qualification" && <HowToQualify competitionId={c.id} all={all} />}

      <WhosEntered competition={c} />

      {venue && (
        <section className="card venue-card">
          <span className="venue-card-label">Venue</span>
          <strong>{venue.name}</strong>
          {(venue.address || venue.postcode) && (
            <span className="venue-card-address">{[venue.address, venue.postcode].filter(Boolean).join(" ")}</span>
          )}
          {venue.notes && <span className="hint">{venue.notes}</span>}
          <a className="button venue-card-directions" href={directionsUrl(venue)} target="_blank" rel="noopener noreferrer">
            Get directions
          </a>
        </section>
      )}

      {honours.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <h2>Honours board</h2>
          </div>
          <div className="card honours">
            {honours.map((h) => {
              const year = all.find((x) => x.slug === c.slug && x.year === h.year);
              return (
                <div key={h.year} className="honours-row">
                  <span className="honours-year">{h.year}</span>
                  <span className="honours-winner">
                    {year ? (
                      <Link href={competitionPath(year, all)}>
                        <PlayerName name={h.winner} />
                      </Link>
                    ) : (
                      <PlayerName name={h.winner} />
                    )}
                  </span>
                  {h.runnerUp && <span className="honours-runner">runner-up {h.runnerUp}</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {otherYears.length > 0 && (
        <p className="comp-page-years">
          Other years:{" "}
          {otherYears.map((y, i) => (
            <span key={y.id}>
              {i > 0 && " · "}
              <Link href={competitionPath(y, all)}>{y.year}</Link>
            </span>
          ))}
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page page-photo comp-page">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader compact />
      <Link href="/competitions" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> All competitions
      </Link>
      {children}
      <PublicFooter />
    </div>
  );
}

// One session: ticked when finished (with how many went through), Live
// tonight, start time for one still to come, Finals Day in gold
function ScheduleRow({ session: s, competition: c, today }: { session: PublicSession; competition: PublicCompetition; today: string }) {
  const finals = s.kind === "finals";
  const postponed = postponedLabel(s);
  const was = originalDateLabel(s);
  const details: string[] = [];
  if (postponed) details.push(postponed);
  else if (s.date) details.push(shortDate(s.date));
  else details.push("Date to be confirmed");
  if (s.status === "complete" && s.kind === "qualifier" && c.qualifiers_per_night) details.push(`${c.qualifiers_per_night} through`);
  else if (s.status === "live") details.push(s.date === today ? "tonight" : "in play");
  else if (s.status === "upcoming" && sessionTimes(s)) details.push(sessionTimes(s)!);
  if (finals && s.status === "upcoming" && c.draw_size) details.push(`${c.draw_size} qualifiers`);

  return (
    <Link
      href={`/night/${s.id}`}
      className={`comp-schedule-row ${finals ? "comp-schedule-finals" : ""} ${s.status === "live" ? "comp-schedule-live" : ""}`}
    >
      <span className="comp-schedule-main">
        <strong>
          {s.status === "complete" && <span aria-label="Finished">&#10003; </span>}
          {sessionTitle(s)}
        </strong>
        <span>{details.join(" · ")}</span>
        {was && <span className="comp-schedule-was">{was}</span>}
      </span>
      {s.status === "live" ? (
        <span className="comp-pill comp-pill-live">
          <span className="live-dot" />
          Live
        </span>
      ) : (
        <span className="comp-schedule-open" aria-hidden="true">
          &rsaquo;
        </span>
      )}
    </Link>
  );
}
