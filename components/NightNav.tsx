"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { fetchNightStatuses } from "@/lib/nightStatus";
import type { Night } from "@/lib/types";
import type { NightStatus } from "@/lib/bracket";

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

  // Status badges are only shown on the home variant, so only that one
  // needs to know it - and needs to hear about every match changing, not
  // just one night's, since they're all shown together.
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
          return (
            <Link key={n.id} href={`/night/${n.id}`} className={`night-card night-card-${n.kind}`}>
              <span className="night-card-name">{n.name}</span>
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
