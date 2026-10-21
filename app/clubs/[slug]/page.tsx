"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { todayIso, type ListFilter } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import CompetitionList from "@/components/home/CompetitionList";
import VenueCard from "@/components/VenueCard";
import { useVenues } from "@/lib/useVenues";
import { clubs } from "@/lib/siteMenu";

// One club's page: all its competitions, a year at a time
export default function ClubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { competitions, failed } = usePublicCompetitions();
  const today = todayIso();
  const [listYear, setListYear] = useState<number | null>(null);
  const [filter, setFilter] = useState<ListFilter>("all");
  const all = useMemo(() => competitions ?? [], [competitions]);
  const club = all.find((c) => c.organiser.kind === "club" && c.organiser.slug === slug)?.organiser;
  const years = useMemo(
    () => [...new Set(all.filter((c) => c.organiser.id === club?.id).map((c) => c.year))].sort((a, b) => b - a),
    [all, club]
  );
  const thisYear = Number(today.slice(0, 4));
  const year = listYear ?? (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const venueId = club ? (clubs(all).find((x) => x.id === club.id)?.venueId ?? null) : null;
  const venue = useVenues([venueId]).get(venueId ?? "");

  return (
    <PublicPage title={club?.name ?? "Club"} loading={competitions === null} failed={failed} back="/clubs">
      {competitions !== null && !club && <p className="night-header-hint">No club at this address.</p>}
      {venue && <VenueCard venue={venue} />}
      {club && (
        <CompetitionList
          all={all}
          year={year}
          years={years}
          onYear={setListYear}
          filter={filter}
          onFilter={setFilter}
          today={today}
          organiserId={club.id}
        />
      )}
    </PublicPage>
  );
}
