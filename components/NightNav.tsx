"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Night } from "@/lib/types";

// The tabs across a session page for moving between a competition's
// sessions: "Session 1", "Session 2" ... "Finals Day". Only that competition's
// sessions are loaded, and a one-session competition has no tabs at all.
export default function NightNav({ competitionId, currentId }: { competitionId: string | null; currentId: string }) {
  const [nights, setNights] = useState<Night[]>([]);

  useEffect(() => {
    if (!competitionId) return;
    let cancelled = false;
    supabase
      .from("nights")
      .select("*")
      .eq("competition_id", competitionId)
      .order("session_number")
      .then(({ data }) => {
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
          {n.kind === "qualifier" ? `Session ${n.session_number ?? ""}`.trim() : n.kind === "finals" ? "Finals Day" : n.kind === "final" ? "Final" : "One day"}
        </Link>
      ))}
    </nav>
  );
}
