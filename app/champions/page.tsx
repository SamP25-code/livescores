"use client";

import { useMemo } from "react";
import { usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { competitionPath } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import CompetitionRow from "@/components/home/CompetitionRow";
import MonthGroups from "@/components/home/MonthGroups";
import PlayerLinks from "@/components/PlayerLinks";
import { organiserPill } from "@/components/home/HomeLists";

// Every winner, newest first, a box for each year
export default function ChampionsPage() {
  const { competitions, failed } = usePublicCompetitions();
  const all = useMemo(() => competitions ?? [], [competitions]);
  const won = all
    .filter((c) => c.champion)
    .sort((a, b) => (b.champion!.date ?? `${b.year}`).localeCompare(a.champion!.date ?? `${a.year}`));

  return (
    <PublicPage title="Champions" loading={competitions === null} failed={failed}>
      {competitions !== null && won.length === 0 && <p className="quiet-line">No champions yet</p>}
      <MonthGroups
        by="year"
        items={won}
        dateOf={(c) => c.champion!.date ?? `${c.year}-01-01`}
        render={(c) => (
          <CompetitionRow
            key={c.id}
            date={c.champion!.date}
            title={c.name}
            href={competitionPath(c, all)}
            pill={organiserPill(c, all)}
            line={
              <>
                Won by <PlayerLinks name={c.champion!.name} ids={c.champion!.winnerIds} className="home-row-champion" />
              </>
            }
          />
        )}
      />
    </PublicPage>
  );
}
