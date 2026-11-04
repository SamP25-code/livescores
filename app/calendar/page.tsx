"use client";

import { useMemo, useState } from "react";
import { usePublicCompetitions, usePublicQualifiers } from "@/lib/usePublicCompetitions";
import { coloursFor, monthGrid, todayIso } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import HomeCalendar from "@/components/home/HomeCalendar";

// The calendar on its own page: step a month at a time or jump to any month
// and year; tap a date to see what's on, or a competition to open it. The
// Masters' qualifying competitions are on it too, on the day of their final.
export default function CalendarPage() {
  const { competitions, failed } = usePublicCompetitions();
  const today = todayIso();
  const [view, setView] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const all = useMemo(() => competitions ?? [], [competitions]);
  const gridDays = useMemo(() => monthGrid(view.year, view.month).flat().map((d) => d.iso), [view]);
  const loadedQualifiers = usePublicQualifiers();
  // Those not run on this site (one that is shows as its own competition),
  // with a date for their final
  const qualifiers = useMemo(
    () => (loadedQualifiers ?? []).filter((q) => q.finalDate && !q.sourceCompetitionId),
    [loadedQualifiers]
  );
  // Each qualifier its own colour, like any competition, so two finals on
  // one day always show as two
  const colours = useMemo(
    () => coloursFor([...all, ...qualifiers.map((q) => ({ id: q.id, sessions: [{ date: q.finalDate }] }))] as Parameters<typeof coloursFor>[0], gridDays),
    [all, qualifiers, gridDays]
  );

  return (
    <PublicPage title="Calendar" loading={competitions === null || loadedQualifiers === null} failed={failed}>
      {competitions !== null && (
        <section className="home-section">
          <HomeCalendar
            competitions={all}
            qualifiers={qualifiers}
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
