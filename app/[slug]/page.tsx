"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { settingsSummary } from "@/lib/competitionSetup";
import { loadHonours, loadPublicCompetitions, type HonoursRow } from "@/lib/publicData";
import {
  eventPath,
  competitionPath,
  nextSession,
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
import { originalDateLabel, postponedLabel } from "@/lib/venues";
import PlayerLinks from "@/components/PlayerLinks";
import { SponsorPanel } from "@/components/Sponsors";
import HowToQualify from "@/components/HowToQualify";
import EventPage from "@/components/event/EventPage";
import type { Venue } from "@/lib/types";
import PublicPage from "@/components/PublicPage";
import VenueCard from "@/components/VenueCard";
import { usePageBackground } from "@/lib/backgrounds";
import ShareButton from "@/components/ShareButton";
import { competitionShareText } from "@/lib/shareResults";
import LivePill from "@/components/home/LivePill";

export const dynamic = "force-dynamic";

// One competition: name and year, who runs it and its sponsors, its settings,
// its schedule (each session opens its draw), where it's played, and its
// honours board. /october-singles is always the latest year;
// /october-singles-2026 is that year.
export default function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [all, setAll] = useState<PublicCompetition[] | null>(null);
  // The competition's venue first, then any session played somewhere else
  // (a county competition's sessions move between clubs)
  const [venues, setVenues] = useState<Venue[]>([]);
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
        const ids = [...new Set([c.venue_id, ...c.sessions.map((s) => s.venue_id)].filter((v): v is string => Boolean(v)))];
        const [venueRows, rows] = await Promise.all([
          ids.length
            ? supabase.from("venues").select("*").in("id", ids).then((r) => (r.data ?? []) as Venue[])
            : Promise.resolve([] as Venue[]),
          loadHonours(c.slug, comps),
        ]);
        if (cancelled) return;
        setVenues(ids.map((id) => venueRows.find((v) => v.id === id)).filter((v): v is Venue => Boolean(v)));
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
  // Its own background, or its event's
  usePageBackground(c?.background_url ?? c?.organiser.background_image ?? null);

  useEffect(() => {
    document.title = c ? `${c.name} ${c.year} · ${SITE_NAME}` : SITE_NAME;
  }, [c]);

  if (failed) {
    return (
      <Shell>
        <p className="quiet-line">Couldn&rsquo;t load &ndash; check your signal and refresh</p>
      </Shell>
    );
  }
  if (!all) {
    return (
      <Shell>
        <p className="quiet-line">Loading&hellip;</p>
      </Shell>
    );
  }
  // An event's address (/blackpool-masters): its own page
  const event = !c ? resolveEvent(all, slug) : null;
  if (event) return <EventPage event={event} all={all} />;

  if (!c) {
    return (
      <Shell>
        <h1 className="public-page-title">Page not found</h1>
        <p className="quiet-line">Nothing at this address</p>
      </Shell>
    );
  }

  const status = publicStatus(c, today);
  const otherYears = all.filter((x) => x.slug === c.slug && x.year !== c.year).sort((a, b) => b.year - a.year);
  const runBy = c.organiser.kind === "event" ? c.organiser.name : c.organiser.short_name;

  return (
    <Shell
      back={
        c.organiser.kind === "event" && c.organiser.slug
          ? eventPath(c.organiser.slug, c.year, all)
          : c.organiser.kind === "county"
            ? "/county"
            : "/competitions"
      }
    >
      <header className="comp-page-head">
        <h1 className="comp-page-title">
          {c.name} {c.year}
        </h1>
        <p className="comp-page-by">
          {status === "live" && (
            <LivePill />
          )}{" "}
          {[runBy, settingsSummary(c).replace(", one day", "")].join(" · ")}
        </p>
        <SponsorPanel sponsors={c.sponsors} />
      </header>

      {c.champion && (
        <div className="champion-banner">
          <PlayerLinks name={c.champion.name} ids={c.champion.winnerIds} />
          <span className="hint">
            {c.name} {c.year} champion
            {c.champion.runnerUp ? " · runner-up " : ""}
            {c.champion.runnerUp && <PlayerLinks name={c.champion.runnerUp} ids={c.champion.runnerUpIds} className="" />}
          </span>
        </div>
      )}

      {c.sessions.length === 0 ? (
        <p className="quiet-line">Dates to be confirmed</p>
      ) : (
        <div className="card comp-schedule">
          {c.sessions.map((s) => (
            <ScheduleRow key={s.id} session={s} competition={c} today={today} venues={venues} />
          ))}
        </div>
      )}

      {c.entry_method === "qualification" && <HowToQualify competitionId={c.id} all={all} />}

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
                    <PlayerLinks name={h.winner} ids={h.winnerIds} />
                    {year && (
                      <Link href={competitionPath(year, all)} className="honours-results">
                        Results
                      </Link>
                    )}
                  </span>
                  {h.runnerUp && (
                    <span className="honours-runner">
                      runner-up <PlayerLinks name={h.runnerUp} ids={h.runnerUpIds} className="" />
                    </span>
                  )}
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

      <ShareButton
        label="Share"
        title={`${c.name} ${c.year}`}
        text={() => {
          const next = nextSession(c, today);
          return competitionShareText({
            title: `${c.name} ${c.year}`,
            runBy,
            champion: c.champion?.name ?? null,
            runnerUp: c.champion?.runnerUp ?? null,
            next: next ? [sessionTitle(next), next.date ? shortDate(next.date) : null, sessionTimes(next)].filter(Boolean).join(" · ") : null,
            url: window.location.href,
          });
        }}
      />

      {/* Where it's played, at the bottom of the page */}
      {venues.map((v, i) => (
        <VenueCard key={v.id} venue={v} spaced={i === 0} />
      ))}
    </Shell>
  );
}

// The shared page frame, with Back to wherever this competition lives
function Shell({ children, back = "/competitions" }: { children: React.ReactNode; back?: string }) {
  return (
    <PublicPage loading={false} failed={false} back={back}>
      {children}
    </PublicPage>
  );
}

// One session: ticked when finished (with how many went through), Live
// tonight, start time for one still to come, Finals Day in gold
function ScheduleRow({
  session: s,
  competition: c,
  today,
  venues,
}: {
  session: PublicSession;
  competition: PublicCompetition;
  today: string;
  venues: Venue[];
}) {
  const finals = s.kind === "finals";
  const postponed = postponedLabel(s);
  const was = originalDateLabel(s);
  // One line: when, where it's up to, and its start time
  const details: string[] = [];
  if (postponed) details.push(postponed);
  else if (s.date) details.push(shortDate(s.date));
  else details.push("Date to be confirmed");
  if (s.status === "complete") details.push("played");
  if (s.status === "complete" && s.kind === "qualifier" && c.qualifiers_per_night) details.push(`${c.qualifiers_per_night} through`);
  else if (s.status === "live") details.push(s.date === today ? "tonight" : "in play");
  if (finals && s.status === "upcoming" && c.draw_size) details.push(`${c.draw_size} qualifiers`);
  // Where it's played, only when the competition moves between greens (a
  // county one) - otherwise the venue row underneath says it
  const elsewhere = venues.length > 1 && s.venue_id ? venues.find((v) => v.id === s.venue_id) : undefined;
  if (elsewhere) details.push(elsewhere.name);
  if (s.status === "upcoming" && sessionTimes(s)) details.push(sessionTimes(s)!);

  // A one-day competition (or a final) has nothing more to show before its
  // draw is out - the row only opens once there is
  const opens = s.draw_published || s.status !== "upcoming" || s.kind === "qualifier" || s.kind === "finals";
  const className = `comp-schedule-row ${finals ? "comp-schedule-finals" : ""} ${s.status === "live" ? "comp-schedule-live" : ""}`;
  const inner = (
    <>
      <span className="comp-schedule-main">
        <span className="comp-schedule-line">
          <strong>
            {sessionTitle(s)}
          </strong>{" "}
          &middot; {details.join(" · ")}
        </span>
        {was && <span className="comp-schedule-was">{was}</span>}
      </span>
      {s.status === "live" ? (
        <LivePill />
      ) : (
        opens && (
          <span className="comp-schedule-open" aria-hidden="true">
            &rsaquo;
          </span>
        )
      )}
    </>
  );
  return opens ? (
    <Link href={`/night/${s.id}`} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
