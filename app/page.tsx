"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { loadLiveMatches, loadPublicCompetitions, type LiveMatch } from "@/lib/publicData";
import {
  coloursFor,
  monthFor,
  monthGrid,
  nextUp,
  todayIso,
  type ListFilter,
  type PublicCompetition,
} from "@/lib/publicCompetitions";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import NightNav from "@/components/NightNav";
import Brand from "@/components/Brand";
import LiveNowBanner from "@/components/LiveNowBanner";
import LiveScores from "@/components/home/LiveScores";
import NextUp from "@/components/home/NextUp";
import HomeCalendar from "@/components/home/HomeCalendar";
import CompetitionList from "@/components/home/CompetitionList";
import RecentChampions from "@/components/home/RecentChampions";
import PublicFooter from "@/components/PublicFooter";
import LatestResults from "@/components/home/LatestResults";

export const dynamic = "force-dynamic";

// The home page, built around why people arrive: what's the score, when am I
// playing, what's on and who won. The top changes with what's happening -
// live scores, or Next up - and the rest is always the same: the calendar,
// the competitions, recent champions. Full draws are one tap away.
export default function HomePage() {
  const [competitions, setCompetitions] = useState<PublicCompetition[] | null>(null);
  const [live, setLive] = useState<LiveMatch[]>([]);
  const [failed, setFailed] = useState(false);
  const today = todayIso();
  const [view, setView] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [listYear, setListYear] = useState<number | null>(null);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [highlightId, setHighlightId] = useState<string | null>(null);

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
  const years = useMemo(() => [...new Set(all.map((c) => c.year))].sort((a, b) => b - a), [all]);
  const thisYear = Number(today.slice(0, 4));
  const year = listYear ?? (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const gridDays = useMemo(() => monthGrid(view.year, view.month).flat().map((d) => d.iso), [view]);
  const colours = useMemo(() => coloursFor(all, gridDays), [all, gridDays]);

  function highlight(id: string | null) {
    setHighlightId(id);
    const c = all.find((x) => x.id === id);
    if (c) {
      const dates = c.sessions.map((s) => s.date).filter((d): d is string => Boolean(d));
      if (dates.length && !dates.some((d) => gridDays.includes(d))) setView(monthFor(dates, today));
    }
  }

  // A database not yet moved to the 2027 structure: the home page as it was
  if (competitions !== null && competitions.length === 0 && !failed) return <OldHome />;

  const picks = live.length === 0 ? nextUp(all, today) : [];
  const highlighted = all.find((c) => c.id === highlightId);

  return (
    <div className="page page-photo home">
      <div className="public-background" aria-hidden="true" />
      <header className="home-header">
        <h1 className="home-title">{SITE_NAME}</h1>
        <p className="home-tagline">{SITE_TAGLINE}</p>
      </header>

      {failed && (
        <p className="night-header-hint">Having trouble loading this page? Check your connection and try refreshing.</p>
      )}
      {competitions === null && !failed && <p className="night-header-hint">Loading&hellip;</p>}

      {live.length > 0 ? (
        <LiveScores matches={live} competitions={all} />
      ) : picks.length > 0 ? (
        <NextUp picks={picks} all={all} today={today} />
      ) : (
        // Nothing live or coming up: the latest results instead of an empty top
        <LatestResults all={all} today={today} />
      )}

      {competitions !== null && (
        <>
          <section className="home-section">
            <div className="home-section-head">
              <h2>Calendar</h2>
            </div>
            <HomeCalendar
              competitions={all}
              colours={colours}
              year={view.year}
              month={view.month}
              onMonth={(y, m) => setView({ year: y, month: m })}
              today={today}
              highlightId={highlightId}
              onHighlight={highlight}
            />
            {highlighted && (
              <div className="home-showing">
                <span>
                  Showing <strong>{highlighted.name}</strong>
                </span>
                <button type="button" className="link-button" onClick={() => setHighlightId(null)}>
                  Show all
                </button>
              </div>
            )}
          </section>

          <CompetitionList
            all={all}
            year={year}
            years={years}
            onYear={setListYear}
            filter={filter}
            onFilter={setFilter}
            colours={colours}
            today={today}
            highlightId={highlightId}
            onHighlight={highlight}
          />

          <RecentChampions all={all} />
        </>
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
