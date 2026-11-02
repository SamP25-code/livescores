"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { shortDate } from "@/lib/publicCompetitions";
import type { Night } from "@/lib/types";

const KIND_LABEL: Record<string, string> = { finals: "Finals", final: "Final", single_day: "One day" };

// The tabs across a session page for moving between a competition's
// sessions. Once a session has a date, its tab shows the day and date
// ("Fri" over "23 Apr"; Finals Day as "Finals · Sat" over "1 May"); until
// then "Session 1" ... "Finals Day". Only that competition's sessions are
// loaded, and a one-session competition has no tabs at all.
// Kept between tabs, so the tabs are there straight away on the next one
const seen = new Map<string, Night[]>();

export default function NightNav({ competitionId, currentId }: { competitionId: string | null; currentId: string }) {
  const [nights, setNights] = useState<Night[]>(() => (competitionId ? (seen.get(competitionId) ?? []) : []));

  useEffect(() => {
    if (!competitionId) return;
    if (seen.has(competitionId)) setNights(seen.get(competitionId)!);
    let cancelled = false;
    supabase
      .from("nights")
      .select("*")
      .eq("competition_id", competitionId)
      .order("session_number")
      .then(({ data }) => {
        if (data) seen.set(competitionId, data as Night[]);
        if (!cancelled) setNights((data ?? []) as Night[]);
      });
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  if (nights.length < 2) return null;

  return (
    <nav className="night-nav" aria-label="This competition's sessions">
      {nights.map((n) => (
        <Link
          key={n.id}
          href={`/night/${n.id}`}
          className={`night-pill night-pill-${n.kind} ${n.id === currentId ? "active" : ""}`}
          aria-current={n.id === currentId ? "page" : undefined}
        >
          <TabLabel night={n} />
        </Link>
      ))}
    </nav>
  );
}

function TabLabel({ night }: { night: Night }) {
  const name =
    night.kind === "qualifier" ? `Session ${night.session_number ?? ""}`.trim() : night.kind === "finals" ? "Finals Day" : (KIND_LABEL[night.kind] ?? "");
  if (!night.date) return <>{name}</>;
  const [day, ...rest] = shortDate(night.date).split(" ");
  const kind = KIND_LABEL[night.kind];
  return (
    <span className="night-pill-dated" aria-label={`${name}, ${shortDate(night.date)}`}>
      <small>{kind ? `${kind} · ${day}` : day}</small>
      {rest.join(" ")}
    </span>
  );
}
