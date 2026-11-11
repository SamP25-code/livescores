"use client";

import { useEffect, useState } from "react";
import { listEventSponsors } from "@/lib/competitionsApi";
import { SponsorPanel, associateLabel, splitSponsors, type EventSponsorShown, type SponsorShown } from "@/components/Sponsors";

// Each event's sponsors once per visit, so moving between its pages doesn't
// make them blink
const loaded = new Map<string, EventSponsorShown[]>();

// A competition's sponsors on its own page and its sessions' pages. One run
// by an event (the Blackpool Masters) also shows the event's sponsors: its
// main sponsors with the competition's own, then its associate sponsors
// smaller underneath.
export default function CompetitionSponsors({
  sponsors,
  eventId,
  year,
}: {
  sponsors: SponsorShown[];
  // The organiser, when it's an event; null for a club or county competition
  eventId: string | null;
  year: number;
}) {
  const key = eventId ? `${eventId}:${year}` : null;
  const [eventSponsors, setEventSponsors] = useState<EventSponsorShown[]>(() => (key ? loaded.get(key) ?? [] : []));

  useEffect(() => {
    if (!eventId || !key) {
      setEventSponsors([]);
      return;
    }
    let cancelled = false;
    setEventSponsors(loaded.get(key) ?? []);
    listEventSponsors(eventId, year)
      .then((list) => {
        loaded.set(key, list);
        if (!cancelled) setEventSponsors(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId, year, key]);

  const { main, associates } = splitSponsors(eventSponsors, sponsors);
  return (
    <>
      <SponsorPanel sponsors={main} />
      <SponsorPanel sponsors={associates} small label={associateLabel(associates)} />
    </>
  );
}
