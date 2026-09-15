"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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

export default function MatchHistory({ matchId }: { matchId: string }) {
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

  if (events.length === 0) {
    return <p className="hint match-history-empty">No history yet.</p>;
  }

  return (
    <ul className="match-history">
      {events.map((e) => (
        <li key={e.id}>{describeEvent(e)}</li>
      ))}
    </ul>
  );
}
