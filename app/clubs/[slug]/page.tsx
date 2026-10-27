"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useClubOrganisers, usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { todayIso, type ListFilter } from "@/lib/publicCompetitions";
import PublicPage from "@/components/PublicPage";
import CompetitionList from "@/components/home/CompetitionList";
import VenueCard from "@/components/VenueCard";
import { useVenues } from "@/lib/useVenues";
import { clubs, playedByOrAt } from "@/lib/siteMenu";

// One club's page: the competitions it runs and those played on its green,
// a year at a time
export default function ClubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { competitions, failed } = usePublicCompetitions();
  const today = todayIso();
  const [listYear, setListYear] = useState<number | null>(null);
  const [filter, setFilter] = useState<ListFilter>("all");
  const all = useMemo(() => competitions ?? [], [competitions]);
  const { organisers: loadedOrganisers, failed: clubsFailed } = useClubOrganisers();
  const organisers = useMemo(() => loadedOrganisers ?? [], [loadedOrganisers]);
  const summary = useMemo(() => clubs(all, organisers).find((x) => x.href === `/clubs/${slug}`), [all, organisers, slug]);
  const club = summary ? { id: summary.id, venueId: organisers.find((o) => o.id === summary.id)?.venue_id ?? null } : null;
  const belongs = (c: (typeof all)[number]) => (club ? playedByOrAt(club, c) : false);
  const years = [...new Set(all.filter(belongs).map((c) => c.year))].sort((a, b) => b - a);
  const thisYear = Number(today.slice(0, 4));
  const year = listYear ?? (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const venueId = summary?.venueId ?? null;
  const venue = useVenues([venueId]).get(venueId ?? "");

  return (
    <PublicPage title={summary?.name ?? "Club"} loading={competitions === null || (loadedOrganisers === null && !clubsFailed)} failed={failed || clubsFailed} back="/clubs">
      {competitions !== null && loadedOrganisers !== null && !summary && <p className="quiet-line">Nothing at this address</p>}
      {venue && <VenueCard venue={venue} />}
      {club && years.length === 0 && <p className="quiet-line">No competitions yet</p>}
      {club && years.length > 0 && (
        <CompetitionList
          all={all}
          year={year}
          years={years}
          onYear={setListYear}
          filter={filter}
          onFilter={setFilter}
          today={today}
          organiserId={club.id}
          belongs={belongs}
        />
      )}
    </PublicPage>
  );
}
