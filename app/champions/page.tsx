"use client";

import { useMemo } from "react";
import { usePublicCompetitions } from "@/lib/usePublicCompetitions";
import PublicPage from "@/components/PublicPage";
import RecentChampions from "@/components/home/RecentChampions";

// Every winner, newest year first
export default function ChampionsPage() {
  const { competitions, failed } = usePublicCompetitions();
  const all = useMemo(() => competitions ?? [], [competitions]);
  const years = [...new Set(all.filter((c) => c.champion).map((c) => c.year))].sort((a, b) => b - a);

  return (
    <PublicPage title="Champions" loading={competitions === null} failed={failed}>
      {competitions !== null && years.length === 0 && (
        <p className="quiet-line">No champions yet</p>
      )}
      {years.map((y) => (
        <RecentChampions key={y} all={all} year={y} limit={Infinity} title={String(y)} />
      ))}
    </PublicPage>
  );
}
