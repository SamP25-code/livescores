"use client";

import { useEffect, useState } from "react";
import { loadPublicCompetitions } from "@/lib/publicData";
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
