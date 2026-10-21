"use client";

import { useMemo, useState } from "react";
import { usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { todayIso, type ListFilter } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import CompetitionList from "@/components/home/CompetitionList";

// Every county competition (NL&F County), a year at a time. They move
// between clubs, so each one's sessions say where they're played.
export default function CountyPage() {
  const { competitions, failed } = usePublicCompetitions();
  const today = todayIso();
  const [listYear, setListYear] = useState<number | null>(null);
  const [filter, setFilter] = useState<ListFilter>("all");
  const all = useMemo(() => competitions ?? [], [competitions]);
  const years = useMemo(
    () => [...new Set(all.filter((c) => c.organiser.kind === "county").map((c) => c.year))].sort((a, b) => b - a),
    [all]
  );
  const thisYear = Number(today.slice(0, 4));
  const year = listYear ?? (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);

  return (
    <PublicPage title="County" loading={competitions === null} failed={failed}>
      {competitions !== null && (
        <CompetitionList
          all={all}
          year={year}
          years={years}
          onYear={setListYear}
          filter={filter}
          onFilter={setFilter}
          today={today}
          organiserKind="county"
          title="County competitions"
        />
      )}
    </PublicPage>
  );
}
