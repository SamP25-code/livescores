"use client";

import { useMemo, useState } from "react";
import { usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { coloursFor, todayIso, type ListFilter } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import CompetitionList from "@/components/home/CompetitionList";

// Every competition, a year at a time, with the filters and a search box:
// type a club or an event and the list narrows to theirs
export default function CompetitionsPage() {
  const { competitions, failed } = usePublicCompetitions();
  const today = todayIso();
  const [listYear, setListYear] = useState<number | null>(null);
  const [filter, setFilter] = useState<ListFilter>("all");
  const all = useMemo(() => competitions ?? [], [competitions]);
  const years = useMemo(() => [...new Set(all.map((c) => c.year))].sort((a, b) => b - a), [all]);
  const thisYear = Number(today.slice(0, 4));
  const year = listYear ?? (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const colours = useMemo(() => coloursFor(all, []), [all]);

  return (
    <PublicPage title="Competitions" loading={competitions === null} failed={failed}>
      {competitions !== null && (
        <CompetitionList
          all={all}
          year={year}
          years={years}
          onYear={setListYear}
          filter={filter}
          onFilter={setFilter}
          colours={colours}
          today={today}
          searchable
        />
      )}
    </PublicPage>
  );
}
