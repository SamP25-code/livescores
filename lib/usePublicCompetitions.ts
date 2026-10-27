"use client";

import { useEffect, useState } from "react";
import { loadClubOrganisers, loadPublicCompetitionsShared } from "@/lib/publicData";
import type { ClubOrganiser } from "@/lib/siteMenu";
import type { PublicCompetition } from "@/lib/publicCompetitions";

// Every public competition, for the Competitions, Calendar and Champions
// pages. null while loading; failed when the connection let us down.
export function usePublicCompetitions(): { competitions: PublicCompetition[] | null; failed: boolean } {
  const [competitions, setCompetitions] = useState<PublicCompetition[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadPublicCompetitionsShared()
      .then((c) => !cancelled && setCompetitions(c))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return { competitions, failed };
}

// Every club (the Clubs page, a club's page): null while loading, and
// whether it failed - so a club page doesn't say "Nothing at this address"
// just because the list didn't arrive
export function useClubOrganisers(): { organisers: ClubOrganiser[] | null; failed: boolean } {
  const [organisers, setOrganisers] = useState<ClubOrganiser[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadClubOrganisers()
      .then((c) => !cancelled && setOrganisers(c))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return { organisers, failed };
}
