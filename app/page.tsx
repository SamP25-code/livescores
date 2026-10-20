"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { loadLiveMatches, loadPublicCompetitions, type LiveMatch } from "@/lib/publicData";
import {
  dateRange,
  eventDates,
  eventPath,
  nextUp,
  publicStatus,
  todayIso,
  type PublicCompetition,
} from "@/lib/publicCompetitions";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import NightNav from "@/components/NightNav";
import Brand from "@/components/Brand";
import LiveNowBanner from "@/components/LiveNowBanner";
import LiveScores from "@/components/home/LiveScores";
import NextUp from "@/components/home/NextUp";
import SiteHeader from "@/components/SiteHeader";
import PublicFooter from "@/components/PublicFooter";
import LatestResults from "@/components/home/LatestResults";

export const dynamic = "force-dynamic";

// The home page: short, like a front page. The latest - live scores when
// something's on, otherwise the latest winner and what's next - then big
// buttons to the main pages: competitions, the calendar, any event coming
// up (the Blackpool Masters), champions. Everything else is in the menu (☰).
export default function HomePage() {
  const [competitions, setCompetitions] = useState<PublicCompetition[] | null>(null);
  const [live, setLive] = useState<LiveMatch[]>([]);
  const [failed, setFailed] = useState(false);
  const today = todayIso();

  useEffect(() => {
    document.title = `${SITE_NAME} · ${SITE_TAGLINE}`;
  }, []);

  // Everything once, then the live scores as they change. Score changes come
  // in fast on a busy night, so they're gathered up: the scores refresh after
  // a moment, the rest of the page (statuses, champions) after a few seconds.
  const timers = useRef<{ live?: ReturnType<typeof setTimeout>; all?: ReturnType<typeof setTimeout> }>({});
  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const [comps, matches] = await Promise.all([loadPublicCompetitions(), loadLiveMatches()]);
        if (cancelled) return;
        setCompetitions(comps);
        setLive(matches);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    async function loadLive() {
      try {
        const matches = await loadLiveMatches();
        if (!cancelled) setLive(matches);
      } catch {
        // Keep what's shown; the next change tries again
      }
    }
    loadAll();
    const t = timers.current;
    const channel = supabase
      .channel("home-scores")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        if (!t.live) t.live = setTimeout(() => ((t.live = undefined), loadLive()), 1500);
        if (!t.all) t.all = setTimeout(() => ((t.all = undefined), loadAll()), 8000);
      })
      .subscribe();
    return () => {
      cancelled = true;
      clearTimeout(t.live);
      clearTimeout(t.all);
      supabase.removeChannel(channel);
    };
  }, []);

  const all = competitions ?? [];

  // A database not yet moved to the 2027 structure: the home page as it was
  if (competitions !== null && competitions.length === 0 && !failed) return <OldHome />;

  const picks = live.length === 0 ? nextUp(all, today) : [];

  // Events still to come (or on now) get a button of their own
  const events = [...new Map(all.filter((c) => c.organiser.kind === "event" && c.organiser.slug).map((c) => [`${c.organiser.id}:${c.year}`, c])).values()]
    .map((c) => {
      const members = all.filter((x) => x.organiser.id === c.organiser.id && x.year === c.year);
      return { organiser: c.organiser, year: c.year, members, dates: eventDates(members) };
    })
    .filter((e) => e.members.some((m) => ["live", "coming_up", "planned"].includes(publicStatus(m, today))))
    .sort((a, b) => (a.dates?.from ?? "9").localeCompare(b.dates?.from ?? "9"));

  return (
    <div className="page page-photo home">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader />

      {failed && (
        <p className="night-header-hint">Having trouble loading this page? Check your connection and try refreshing.</p>
      )}
      {competitions === null && !failed && <p className="night-header-hint">Loading&hellip;</p>}

      <div id="live">
        {live.length > 0 ? (
          <LiveScores matches={live} competitions={all} />
        ) : (
          <>
            <LatestResults all={all} today={today} />
            <NextUp picks={picks} all={all} today={today} />
          </>
        )}
      </div>

      {competitions !== null && (
        <nav className="home-tiles" aria-label="Go to">
          <Link href="/competitions" className="home-tile">
            <span className="home-tile-icon" aria-hidden="true">🏅</span>
            <strong>Competitions</strong>
            <span>All of them, by club</span>
          </Link>
          <Link href="/calendar" className="home-tile">
            <span className="home-tile-icon" aria-hidden="true">📅</span>
            <strong>Calendar</strong>
            <span>What&rsquo;s on when</span>
          </Link>
          {events.map((e) => (
            <Link key={`${e.organiser.id}-${e.year}`} href={eventPath(e.organiser.slug!, e.year, all)} className="home-tile home-tile-event">
              <span className="home-tile-icon" aria-hidden="true">⭐</span>
              <span>
                <strong>
                  {e.organiser.name} {e.year}
                </strong>
                <span>
                  {e.dates ? `${dateRange(e.dates.from, e.dates.to)} · ` : ""}
                  {e.members.length} competition{e.members.length === 1 ? "" : "s"}
                </span>
              </span>
            </Link>
          ))}
          <Link href="/champions" className="home-tile">
            <span className="home-tile-icon" aria-hidden="true">🏆</span>
            <strong>Champions</strong>
            <span>Winners and honours</span>
          </Link>
        </nav>
      )}

      <PublicFooter line="Live scores for crown green competitions, free to follow." />
    </div>
  );
}

// Before the 2027 move: the October Singles home page, unchanged
function OldHome() {
  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <div className="top-bar">
        <Brand />
      </div>

      <div className="home-hero">
        <h1>October Singles 2026</h1>
        <p className="hint home-times">
          <strong>Qualifying nights</strong>
          <span>Practice 6:30pm &middot; Start 7pm</span>
        </p>
        <p className="hint home-times">
          <strong>Finals Day</strong>
          <span>Practice 12:30pm &middot; Start 1pm</span>
        </p>
      </div>
      <LiveNowBanner />
      <NightNav variant="home" />

      <nav className="page-footer-nav">
        <Link href="/admin">Log in</Link>
      </nav>
    </div>
  );
}
