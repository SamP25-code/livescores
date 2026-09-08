"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { buildFinalsSlots, roundLabel } from "@/lib/bracket";
import NightNav from "@/components/NightNav";
import type { MatchRow, Night, Player } from "@/lib/types";

export default function NightPage({ params }: { params: { id: string } }) {
  const nightId = params.id;
  const [night, setNight] = useState<Night | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [matches, setMatches] = useState<MatchRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: nightData }, { data: playerData }, { data: matchData }] = await Promise.all([
        supabase.from("nights").select("*").eq("id", nightId).single(),
        supabase.from("players").select("*").eq("night_id", nightId),
        supabase.from("matches").select("*").eq("night_id", nightId).order("round").order("slot"),
      ]);
      if (cancelled) return;
      setNight(nightData ?? null);
      setPlayers(Object.fromEntries((playerData ?? []).map((p) => [p.id, p])));
      setMatches(matchData ?? []);
    }

    load();

    // Live updates: re-fetch the affected match whenever anything changes.
    const channel = supabase
      .channel(`night-${nightId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `night_id=eq.${nightId}` },
        (payload) => {
          setMatches((prev) => {
            const row = payload.new as MatchRow;
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== (payload.old as MatchRow).id);
            }
            const exists = prev.some((m) => m.id === row.id);
            const next = exists ? prev.map((m) => (m.id === row.id ? row : m)) : [...prev, row];
            return next.sort((a, b) => a.round - b.round || a.slot - b.slot);
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [nightId]);

  const rounds = useMemo(() => {
    const byRound = new Map<number, MatchRow[]>();
    for (const m of matches) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round)!.push(m);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1][0] : 0;

  const qualifiers = useMemo(() => {
    if (!night || night.kind !== "qualifier" || lastRound === 0) return [];
    return matches
      .filter((m) => m.round === lastRound && m.status === "complete" && m.winner_id)
      .sort((a, b) => a.slot - b.slot)
      .map((m) => (m.winner_id ? players[m.winner_id] : undefined))
      .filter((p): p is Player => Boolean(p));
  }, [matches, players, night, lastRound]);

  // Before finals day's bracket is generated, players still arrive one at a
  // time as each qualifying night finishes - show the full 16-slot lineup,
  // filled in as far as it's got, blank where a name isn't confirmed yet.
  const finalsSlots = useMemo(() => {
    if (!night || night.kind !== "finals" || rounds.length > 0) return [];
    return buildFinalsSlots(Object.values(players));
  }, [players, night, rounds]);

  return (
    <div className="page">
      <div className="top-bar">
        <Link href="/" className="brand">
          Bowls Live
        </Link>
      </div>

      <NightNav currentId={nightId} />

      <h1>{night?.name ?? "Loading\u2026"}</h1>

      {rounds.length === 0 && finalsSlots.length === 0 && (
        <p className="empty">The draw hasn&rsquo;t been entered for this night yet.</p>
      )}

      {rounds.length === 0 && finalsSlots.length > 0 && (
        <>
          <p className="hint">Qualifiers confirmed so far &mdash; the lineup fills in as each qualifying night finishes.</p>
          <div className="card">
            {finalsSlots.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>
                  {i + 1}. {p ? p.name : ""}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {rounds.map(([round, roundMatches]) => (
        <section key={round}>
          <div className="round-heading">
            <h2>{roundLabel(night?.kind ?? "qualifier", round, roundMatches.length)}</h2>
            <span className="count">{roundMatches.length} match{roundMatches.length === 1 ? "" : "es"}</span>
          </div>
          {roundMatches.map((m) => (
            <MatchCard key={m.id} match={m} players={players} />
          ))}
        </section>
      ))}

      {qualifiers.length > 0 && (
        <section>
          <div className="round-heading">
            <h2>Advancing to finals day</h2>
          </div>
          {qualifiers.map((p) => (
            <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>{p.name}</span>
              <span style={{ color: "var(--ink-soft)" }}>{p.finals_number != null ? `Finals ${p.finals_number}` : ""}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function MatchCard({ match, players }: { match: MatchRow; players: Record<string, Player> }) {
  const nameA = match.player_a_id ? players[match.player_a_id]?.name ?? "TBC" : "TBC";
  const nameB = match.player_b_id ? players[match.player_b_id]?.name ?? "TBC" : "TBC";

  return (
    <div className="card match">
      <div className="players">
        <div className={`player-row ${match.winner_id === match.player_a_id ? "winner" : ""}`}>
          <span className="name">{nameA}</span>
          <span className="score">{match.player_a_id ? match.score_a : "\u2013"}</span>
        </div>
        <hr className="divider" />
        <div className={`player-row ${match.winner_id === match.player_b_id ? "winner" : ""}`}>
          <span className="name">{nameB}</span>
          <span className="score">{match.player_b_id ? match.score_b : "\u2013"}</span>
        </div>
      </div>
      <span className={`status-pill ${match.status}`}>{match.status}</span>
    </div>
  );
}
