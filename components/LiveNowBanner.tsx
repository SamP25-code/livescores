"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type LiveNight = { nightId: string; nightName: string; count: number };

export default function LiveNowBanner() {
  const [liveNights, setLiveNights] = useState<LiveNight[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: matches } = await supabase.from("matches").select("night_id").eq("status", "live");
      if (cancelled) return;
      if (!matches || matches.length === 0) {
        setLiveNights([]);
        return;
      }

      const counts = new Map<string, number>();
      for (const m of matches) counts.set(m.night_id, (counts.get(m.night_id) ?? 0) + 1);

      const { data: nights } = await supabase.from("nights").select("id, name").in("id", [...counts.keys()]);
      if (cancelled) return;

      setLiveNights((nights ?? []).map((n) => ({ nightId: n.id, nightName: n.name, count: counts.get(n.id) ?? 0 })));
    }

    load();

    const channel = supabase
      .channel("home-live-now")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  if (liveNights.length === 0) return null;

  return (
    <div className="live-now-banner">
      <span className="live-dot" />
      <div className="live-now-list">
        {liveNights.map((n) => (
          <Link key={n.nightId} href={`/night/${n.nightId}`} className="live-now-item">
            {n.nightName} <span className="live-now-count">{n.count} match{n.count === 1 ? "" : "es"} live</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
