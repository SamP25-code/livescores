"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getInitials } from "@/components/Avatar";
import type { MatchEvent } from "@/lib/types";

function describeEvent(e: MatchEvent): string {
  switch (e.event_type) {
    case "score":
      return `${e.score_a} - ${e.score_b}`;
    case "complete":
      return `Match complete: ${e.score_a} - ${e.score_b}`;
    case "reopen":
      return "Match reopened for correction";
    case "no_show":
      return "No-show recorded - match awarded automatically";
  }
}

type Scorer = "a" | "b" | "correction";

// Works out who each point went to by comparing it with the score before
// it. A score going down means the scorer pressed minus to fix a mistake.
function scorers(events: MatchEvent[]): Map<string, Scorer> {
  const result = new Map<string, Scorer>();
  let prevA = 0;
  let prevB = 0;
  for (const e of events) {
    if (e.event_type === "score") {
      if (e.score_a < prevA || e.score_b < prevB) result.set(e.id, "correction");
      else if (e.score_a > prevA) result.set(e.id, "a");
      else if (e.score_b > prevB) result.set(e.id, "b");
    }
    prevA = e.score_a;
    prevB = e.score_b;
  }
  return result;
}

export default function MatchHistory({
  matchId,
  admin = false,
  nameA,
  nameB,
}: {
  matchId: string;
  admin?: boolean;
  nameA?: string;
  nameB?: string;
}) {
  const [events, setEvents] = useState<MatchEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("match_events")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      if (!cancelled) setEvents(data ?? []);
    }

    load();

    const channel = supabase
      .channel(`match-events-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as MatchEvent]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  // A reopen is an admin correcting a mistake, not something worth
  // surfacing to viewers - shown only on the admin side.
  const visibleEvents = admin ? events : events.filter((e) => e.event_type !== "reopen");

  if (visibleEvents.length === 0) {
    return <p className="hint match-history-empty">No history yet.</p>;
  }

  if (!nameA || !nameB) {
    return (
      <ul className="match-history">
        {visibleEvents.map((e) => (
          <li key={e.id}>{describeEvent(e)}</li>
        ))}
      </ul>
    );
  }

  // Initials keep each line short, since the full names are shown just
  // above - unless both players share initials, where they'd be ambiguous.
  const initialsA = getInitials(nameA);
  const initialsB = getInitials(nameB);
  const labelA = initialsA === initialsB ? nameA : initialsA;
  const labelB = initialsA === initialsB ? nameB : initialsB;
  const scorerOf = scorers(events);

  return (
    <ul className="match-history match-history-grid">
      {visibleEvents.map((e) => {
        const scorer = scorerOf.get(e.id);
        if (e.event_type !== "score" || scorer === "correction" || !scorer) {
          const text = scorer === "correction" ? `Correction: ${e.score_a} - ${e.score_b}` : describeEvent(e);
          return (
            <li key={e.id} className="match-history-note">
              {text}
            </li>
          );
        }
        return (
          <li key={e.id} className="match-history-line">
            <span className={scorer === "a" ? "match-history-scorer" : ""}>{labelA}</span>
            <span className="match-history-score">
              {e.score_a} - {e.score_b}
            </span>
            <span className={scorer === "b" ? "match-history-scorer" : ""}>{labelB}</span>
          </li>
        );
      })}
    </ul>
  );
}
