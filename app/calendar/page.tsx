"use client";

import { useMemo, useState } from "react";
import { usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { coloursFor, monthFor, monthGrid, todayIso } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import HomeCalendar from "@/components/home/HomeCalendar";

// The calendar on its own page: tap a competition to light up its dates,
// tap a date to see what's on
export default function CalendarPage() {
  const { competitions, failed } = usePublicCompetitions();
  const today = todayIso();
  const [view, setView] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const all = useMemo(() => competitions ?? [], [competitions]);
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
  const highlighted = all.find((c) => c.id === highlightId);

  return (
    <PublicPage title="Calendar" loading={competitions === null} failed={failed}>
      {competitions !== null && (
        <section className="home-section">
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
      )}
    </PublicPage>
  );
}
