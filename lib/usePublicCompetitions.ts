"use client";

import { useEffect, useState } from "react";
import { loadClubOrganisers, loadPublicCompetitions } from "@/lib/publicData";
import type { ClubOrganiser } from "@/lib/siteMenu";
import type { PublicCompetition } from "@/lib/publicCompetitions";

// Every public competition, for the Competitions, Calendar and Champions
// pages. null while loading; failed when the connection let us down.
export function usePublicCompetitions(): { competitions: PublicCompetition[] | null; failed: boolean } {
  const [competitions, setCompetitions] = useState<PublicCompetition[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadPublicCompetitions()
      .then((c) => !cancelled && setCompetitions(c))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return { competitions, failed };
}

// Every club (the Clubs page, a club's page); empty until loaded
export function useClubOrganisers(): ClubOrganiser[] {
  const [clubs, setClubs] = useState<ClubOrganiser[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadClubOrganisers()
      .then((c) => !cancelled && setClubs(c))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return clubs;
}
