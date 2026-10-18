"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { fetchNightStatuses } from "@/lib/nightStatus";
import { sessionsShown } from "@/lib/sessionsShown";
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
export function splitNightName(night: Night): { day: string; rest: string } | null {
  if (night.kind === "finals") {
    const match = night.name.match(WEEKDAY_ANYWHERE);
    const rest = (match ? `${match[1]} ${match[2]}` : night.name).trim();
    return rest && rest !== FINALS_LABEL ? { day: FINALS_LABEL, rest } : null;
  }
  const match = night.name.match(WEEKDAY_NAME);
  if (!match || !match[2].trim()) return null;
  return { day: match[1], rest: match[2].trim() };
}

const STATUS_LABEL: Record<NightStatus, string> = {
  upcoming: "Upcoming",
  live: "Live",
  complete: "Finished",
};

const WEEKDAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

// A short label for the tab bar, e.g. "Mon 12" or "Finals" - derived from
// the same split used for the full title, so the two never drift apart.
function shortNightLabel(night: Night): string {
  if (night.kind === "finals") return "Finals";
  const split = splitNightName(night);
  if (!split) return night.name;
  const dayNum = split.rest.match(/\d+/)?.[0];
  const abbr = WEEKDAY_ABBR[split.day] ?? split.day.slice(0, 3);
  return dayNum ? `${abbr} ${dayNum}` : split.day;
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
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("nights").select("*").order("sort_order").order("created_at");
      const all = (data ?? []) as Night[];
      // Only look up competitions once sessions belong to them (2027
      // structure); a database not yet moved over shows every night.
      let competitions: Array<{ id: string; status: "planned" | "active" | "archived"; year: number }> = [];
      if (all.some((n) => n.competition_id)) {
        const { data: comps } = await supabase.from("competitions").select("id, status, year");
        competitions = comps ?? [];
      }
      if (!cancelled) setNights(sessionsShown(all, competitions, currentId));
    })();
    return () => {
      cancelled = true;
    };
  }, [currentId]);

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
              {status !== "upcoming" && (
                <span className={`status-pill ${status}`}>
                  {status === "live" && <span className="live-dot" />}
                  {STATUS_LABEL[status]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="night-nav">
      {nights.map((n) => (
        <Link
          key={n.id}
          href={`/night/${n.id}`}
          className={`night-pill night-pill-${n.kind} ${n.id === currentId ? "active" : ""}`}
        >
          {shortNightLabel(n)}
        </Link>
      ))}
    </nav>
  );
}
