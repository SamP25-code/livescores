"use client";

import { useMemo } from "react";
import CompetitionRow from "@/components/home/CompetitionRow";
import { useClubOrganisers, usePublicCompetitions } from "@/lib/usePublicCompetitions";
import { useVenues } from "@/lib/useVenues";
import { directionsUrl } from "@/lib/venues";
import { clubs } from "@/lib/siteMenu";
import PublicPage from "@/components/PublicPage";

// Every club with a competition on the site, A to Z. Tap a club for its
// competitions; "Map" opens Google Maps for directions to its green.
export default function ClubsPage() {
  const { competitions, failed } = usePublicCompetitions();
  const { organisers, failed: clubsFailed } = useClubOrganisers();
  const list = useMemo(() => clubs(competitions ?? [], organisers ?? []), [competitions, organisers]);
  const venues = useVenues(list.map((c) => c.venueId));

  return (
    <PublicPage title="Clubs" loading={competitions === null || (organisers === null && !clubsFailed)} failed={failed || clubsFailed}>
      {competitions !== null && list.length === 0 && <p className="quiet-line">No clubs yet</p>}
      {list.length > 0 && (
        <div className="card home-rows">
          {list.map((club) => {
            const venue = club.venueId ? venues.get(club.venueId) : undefined;
            return (
              <CompetitionRow
                key={club.id}
                date={false}
                title={club.name}
                href={club.href}
                line={[
                  club.count > 0 ? `${club.count} competition${club.count === 1 ? "" : "s"}` : "No competitions yet",
                  venue?.postcode,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                end={
                  venue && (
                    <a
                      className="club-row-map"
                      href={directionsUrl(venue)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Directions to ${club.name}`}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z M12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z"
                        />
                      </svg>
                      Map
                    </a>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </PublicPage>
  );
}
