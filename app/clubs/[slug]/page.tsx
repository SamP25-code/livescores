"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useClubOrganisers, useClubQualifiers, usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { competitionPath, todayIso, type ListFilter, type PublicCompetition } from "@/lib/publicCompetitions";
import type { ClubQualifier } from "@/lib/publicQualifying";
import PublicPage from "@/components/PublicPage";
import CompetitionList from "@/components/home/CompetitionList";
import CompetitionRow from "@/components/home/CompetitionRow";
import MonthGroups from "@/components/home/MonthGroups";
import PlayerName from "@/components/PlayerName";
import VenueCard from "@/components/VenueCard";
import { useVenues } from "@/lib/useVenues";
import { clubs, playedByOrAt } from "@/lib/siteMenu";

// One club's page: the competitions it runs and those played on its green,
// a year at a time - then the qualifying competitions played there (the
// Masters' qualifiers), most of them not run on this site
export default function ClubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { competitions, failed } = usePublicCompetitions();
  const today = todayIso();
  const [listYear, setListYear] = useState<number | null>(null);
  const [filter, setFilter] = useState<ListFilter>("all");
  const all = useMemo(() => competitions ?? [], [competitions]);
  const { organisers: loadedOrganisers, failed: clubsFailed } = useClubOrganisers();
  const organisers = useMemo(() => loadedOrganisers ?? [], [loadedOrganisers]);
  const loadedQualifiers = useClubQualifiers();
  const summary = useMemo(
    () => clubs(all, organisers, loadedQualifiers ?? []).find((x) => x.href === `/clubs/${slug}`),
    [all, organisers, loadedQualifiers, slug]
  );
  const club = summary ? { id: summary.id, venueId: organisers.find((o) => o.id === summary.id)?.venue_id ?? null } : null;
  const belongs = (c: (typeof all)[number]) => (club ? playedByOrAt(club, c) : false);
  const years = [...new Set(all.filter(belongs).map((c) => c.year))].sort((a, b) => b - a);
  const thisYear = Number(today.slice(0, 4));
  const year = listYear ?? (years.includes(thisYear) ? thisYear : years[0] ?? thisYear);
  const venueId = summary?.venueId ?? null;
  const venue = useVenues([venueId]).get(venueId ?? "");
  // Its qualifiers, leaving out any run on this site that's already listed
  // above
  const qualifiers = (loadedQualifiers ?? []).filter(
    (q) => club?.venueId && q.venueId === club.venueId && !all.some((c) => c.id === q.sourceCompetitionId && belongs(c))
  );

  return (
    <PublicPage
      title={summary?.name ?? "Club"}
      loading={competitions === null || loadedQualifiers === null || (loadedOrganisers === null && !clubsFailed)}
      failed={failed || clubsFailed}
      back="/clubs"
    >
      {competitions !== null && loadedOrganisers !== null && !summary && <p className="quiet-line">Nothing at this address</p>}
      {venue && <VenueCard venue={venue} />}
      {club && years.length === 0 && qualifiers.length === 0 && <p className="quiet-line">No competitions yet</p>}
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
      {qualifiers.length > 0 && <Qualifiers qualifiers={qualifiers} all={all} />}
    </PublicPage>
  );
}

// Each qualifying competition on the green: the date of its final, what
// it qualifies for, and its winner once decided - opening its results, or
// the competition it qualifies for until there are some
function Qualifiers({ qualifiers, all }: { qualifiers: ClubQualifier[]; all: PublicCompetition[] }) {
  // Soonest first, as on the competition's How to qualify
  const sorted = [...qualifiers].sort((a, b) => (a.finalDate ?? "9999").localeCompare(b.finalDate ?? "9999"));
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Qualifying competitions</h2>
      </div>
      <MonthGroups
        items={sorted}
        dateOf={(q) => q.finalDate}
        render={(q) => {
          const into = all.find((c) => c.id === q.qualifiesFor);
          const source = q.sourceCompetitionId ? all.find((c) => c.id === q.sourceCompetitionId) : undefined;
          const who = source ? (source.champion?.name ?? null) : q.who;
          const href = source
            ? competitionPath(source, all)
            : q.hasResults
              ? `/qualifier/${q.id}`
              : into
                ? competitionPath(into, all)
                : undefined;
          return (
            <CompetitionRow
              key={q.id}
              date={q.finalDate}
              title={q.name}
              href={href}
              line={
                <>
                  {into ? `Qualifier for ${into.name} ${into.year} · ` : ""}
                  {who ? (
                    <>
                      Won by <PlayerName name={who} className="home-row-champion" />
                    </>
                  ) : (
                    "Winner to be decided"
                  )}
                </>
              }
            />
          );
        }}
      />
    </section>
  );
}
