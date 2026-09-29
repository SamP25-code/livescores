"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { fetchNightStatuses } from "@/lib/nightStatus";
import type { Night } from "@/lib/types";
import type { NightStatus } from "@/lib/bracket";

const WEEKDAY_NAME = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b\s*(.*)$/i;
const WEEKDAY_ANYWHERE = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b\s*(.*)$/i;
const FINALS_LABEL = "Finals Day";

// Splits "Monday 12th October" into a bold day + a smaller muted date line.
// Finals Day always shows that fixed label as the title, with whatever date
// text the admin entered (however it's worded) pulled out as the subtitle -
// driven by the night's kind rather than guessing from its exact wording.
// Falls back to null (a single line) for anything else that doesn't start
// with a weekday.
function splitNightName(night: Night): { day: string; rest: string } | null {
  if (night.kind === "finals") {
    const match = night.name.match(WEEKDAY_ANYWHERE);
    const rest = (match ? `${match[1]} ${match[2]}` : night.name).trim();
    return rest && rest !== FINALS_LABEL ? { day: FINALS_LABEL, rest } : null;
  }
  const match = night.name.match(WEEKDAY_NAME);
  if (!match || !match[2].trim()) return null;
  return { day: match[1], rest: match[2].trim() };
}

export default function NightNav({
  currentId,
  variant = "compact",
}: {
  currentId?: string;
  variant?: "compact" | "home";
}) {
  const [nights, setNights] = useState<Night[]>([]);
  const [statuses, setStatuses] = useState<Record<string, NightStatus>>({});

  useEffect(() => {
    supabase
      .from("nights")
      .select("*")
      .order("sort_order")
      .order("created_at")
      .then(({ data }) => setNights(data ?? []));
  }, []);

  useEffect(() => {
    if (variant !== "home") return;

    let cancelled = false;
    fetchNightStatuses().then((data) => {
      if (!cancelled) setStatuses(data);
    });

    const channel = supabase
      .channel("home-night-statuses")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        fetchNightStatuses().then((data) => {
          if (!cancelled) setStatuses(data);
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [variant]);

  if (nights.length === 0) return null;

  if (variant === "home") {
    return (
      <nav className="night-list">
        {nights.map((n) => {
          const status = statuses[n.id] ?? "upcoming";
          const split = splitNightName(n);
          return (
            <Link key={n.id} href={`/night/${n.id}`} className={`night-card night-card-${n.kind}`}>
              <span className="night-card-name">
                {split ? (
                  <>
                    <span className="night-card-day">{split.day}</span>
                    <span className="night-card-date">{split.rest}</span>
                  </>
                ) : (
                  n.name
                )}
              </span>
              <span className={`status-pill ${status}`}>
                {status === "live" && <span className="live-dot" />}
                {status}
              </span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="night-nav">
      {nights.map((n) => (
        <Link key={n.id} href={`/night/${n.id}`} className={`night-pill ${n.id === currentId ? "active" : ""}`}>
          {n.name}
        </Link>
      ))}
    </nav>
  );
}
