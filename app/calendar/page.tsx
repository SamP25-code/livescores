"use client";

import { useMemo, useState } from "react";
import { usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { coloursFor, monthGrid, todayIso } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import HomeCalendar from "@/components/home/HomeCalendar";

// The calendar on its own page: step a month at a time or jump to any month
// and year; tap a date to see what's on, or a competition to open it
export default function CalendarPage() {
  const { competitions, failed } = usePublicCompetitions();
  const today = todayIso();
  const [view, setView] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const all = useMemo(() => competitions ?? [], [competitions]);
  const gridDays = useMemo(() => monthGrid(view.year, view.month).flat().map((d) => d.iso), [view]);
  const colours = useMemo(() => coloursFor(all, gridDays), [all, gridDays]);

  return (
    <PublicPage title="Calendar" loading={competitions === null} failed={failed}>
      {competitions !== null && (
        <section className="home-section">
          <HomeCalendar
            competitions={all}
            all={all}
            colours={colours}
            year={view.year}
            month={view.month}
            onMonth={(y, m) => setView({ year: y, month: m })}
            today={today}
          />
        </section>
      )}
    </PublicPage>
  );
}
