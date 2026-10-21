"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { loadLiveMatches, loadPublicCompetitions, type LiveMatch } from "@/lib/publicData";
import {
  dateRange,
  eventDates,
  eventPath,
  comingUp,
  latestResults,
  publicStatus,
  todayIso,
  type PublicCompetition,
} from "@/lib/publicCompetitions";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import NightNav from "@/components/NightNav";
import Brand from "@/components/Brand";
import LiveNowBanner from "@/components/LiveNowBanner";
import LiveScores from "@/components/home/LiveScores";
import SiteHeader from "@/components/SiteHeader";
import PublicFooter from "@/components/PublicFooter";
import { ComingUp, LatestResults } from "@/components/home/HomeLists";

export const dynamic = "force-dynamic";

// The home page, like a front page: live scores when something's on, the
// ways into the site (four buttons, then any event coming up), and two short
// lists to scan - what's coming up and the latest results. Everything else
// is in the menu (☰).
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

  const upcoming = comingUp(all, today);
  const results = latestResults(all, today);

  // Events still to come (or on now) get a button of their own
  const events = [...new Map(all.filter((c) => c.organiser.kind === "event" && c.organiser.slug).map((c) => [`${c.organiser.id}:${c.year}`, c])).values()]
    .map((c) => {
      const members = all.filter((x) => x.organiser.id === c.organiser.id && x.year === c.year);
      // A sponsor's logo, when one's been added, says more than any styling
      const logo = members.flatMap((m) => m.sponsors).find((s) => s.logo_url)?.logo_url ?? null;
      return { organiser: c.organiser, year: c.year, members, dates: eventDates(members), logo };
    })
    .filter((e) => e.members.some((m) => ["live", "coming_up", "planned"].includes(publicStatus(m, today))))
    .sort((a, b) => (a.dates?.from ?? "9").localeCompare(b.dates?.from ?? "9"));

  return (
    <div className="page page-photo home">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader />

      {failed && (
        <p className="night-header-hint">Couldn&rsquo;t load &ndash; check your signal and refresh.</p>
      )}
      {competitions === null && !failed && <p className="night-header-hint">Loading&hellip;</p>}

      {live.length > 0 && (
        <div id="live">
          <LiveScores matches={live} competitions={all} />
        </div>
      )}

      {competitions !== null && (
        <>
          <nav className="home-tiles" aria-label="Go to">
            <Link href="/competitions" className="home-tile">
              <TileIcon name="list" />
              <strong>Competitions</strong>
            </Link>
            <Link href="/calendar" className="home-tile">
              <TileIcon name="calendar" />
              <strong>Calendar</strong>
            </Link>
            <Link href="/clubs" className="home-tile">
              <TileIcon name="pin" />
              <strong>Clubs</strong>
            </Link>
            <Link href="/champions" className="home-tile">
              <TileIcon name="trophy" />
              <strong>Champions</strong>
            </Link>
          </nav>

          {events.map((e) => (
            <Link key={`${e.organiser.id}-${e.year}`} href={eventPath(e.organiser.slug!, e.year, all)} className="home-event-tile">
              {e.logo && <img src={e.logo} alt="" className="home-event-tile-logo" />}
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

          <ComingUp picks={upcoming} all={all} />
          <LatestResults picks={results} all={all} />
        </>
      )}

      <PublicFooter line="Live scores for crown green competitions, free to follow." />
    </div>
  );
}

// Simple line drawings for the three buttons, in the page's green
function TileIcon({ name }: { name: "list" | "calendar" | "pin" | "trophy" }) {
  return (
    <svg className="home-tile-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {name === "list" && (
          <>
            <circle cx="5" cy="6" r="1.2" />
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="5" cy="18" r="1.2" />
            <path d="M9.5 6H20M9.5 12H20M9.5 18H20" />
          </>
        )}
        {name === "calendar" && (
          <>
            <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
          </>
        )}
        {name === "pin" && (
          <>
            <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" />
            <circle cx="12" cy="10" r="2.3" />
          </>
        )}
        {name === "trophy" && (
          <>
            <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
            <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 20h8" />
          </>
        )}
      </g>
    </svg>
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
