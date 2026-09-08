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
  const [viewerCount, setViewerCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);

  useEffect(() => {
    document.title = night ? `${night.name} — Bowls Live` : "Bowls Live";
  }, [night]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [
        { data: nightData, error: nightErr },
        { data: playerData, error: playersErr },
        { data: matchData, error: matchesErr },
      ] = await Promise.all([
        supabase.from("nights").select("*").eq("id", nightId).single(),
        supabase.from("players").select("*").eq("night_id", nightId),
        supabase.from("matches").select("*").eq("night_id", nightId).order("round").order("slot"),
      ]);
      if (cancelled) return;
      if (nightErr || playersErr || matchesErr) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setNight(nightData ?? null);
      setPlayers(Object.fromEntries((playerData ?? []).map((p) => [p.id, p])));
      setMatches(matchData ?? []);
    }

    load();

    // Live updates: re-fetch the affected match whenever anything changes.
    // The same channel also tracks presence, so "N watching now" is free -
    // no extra connection, no database writes.
    const channel = supabase
      .channel(`night-${nightId}`, { config: { presence: { key: crypto.randomUUID() } } })
      .on("presence", { event: "sync" }, () => {
        setViewerCount(Object.keys(channel.presenceState()).length);
      })
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `night_id=eq.${nightId}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "DELETE") {
              const { [(payload.old as Player).id]: _removed, ...rest } = prev;
              return rest;
            }
            const row = payload.new as Player;
            return { ...prev, [row.id]: row };
          });
        }
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnectionLost(false);
          await channel.track({ online_at: new Date().toISOString() });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnectionLost(true);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [nightId]);

  const [highlightPlayerId, setHighlightPlayerId] = useState<string | null>(null);

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

  // Finals day plays down to a single deciding match - once it's complete,
  // that's the competition won. Qualifying nights never reach a single
  // match (their last round always narrows to several winners advancing,
  // not one overall champion), so this only ever fires for finals day.
  const champion = useMemo(() => {
    if (!night || night.kind !== "finals" || rounds.length === 0) return null;
    const [, lastRoundMatches] = rounds[rounds.length - 1];
    if (lastRoundMatches.length !== 1) return null;
    const finalMatch = lastRoundMatches[0];
    if (finalMatch.status !== "complete" || !finalMatch.winner_id) return null;
    return players[finalMatch.winner_id] ?? null;
  }, [night, rounds, players]);

  return (
    <div className="page">
      <div className="top-bar">
        <Link href="/" className="brand">
          Bowls Live
        </Link>
      </div>

      <NightNav currentId={nightId} />

      <h1 style={{ textAlign: "center" }}>{night?.name ?? "Loading\u2026"}</h1>

      {loadError && (
        <p className="empty" style={{ textAlign: "center" }}>
          Having trouble loading this page &mdash; check your connection and try refreshing.
        </p>
      )}

      {!loadError && connectionLost && (
        <p className="hint" style={{ textAlign: "center" }}>
          Live updates paused &mdash; reconnecting&hellip;
        </p>
      )}

      {!loadError && viewerCount > 0 && (
        <p style={{ textAlign: "center", margin: "0 0 20px" }}>
          <span className="count">
            {viewerCount} watching now
          </span>
        </p>
      )}

      {!loadError && champion && (
        <div className="champion-banner">
          <span className="trophy">\ud83c\udfc6</span>
          <span className="name">{champion.name}</span>
          <span className="hint">wins the competition!</span>
        </div>
      )}

      {!loadError && rounds.length === 0 && finalsSlots.length === 0 && (
        <p className="empty" style={{ textAlign: "center" }}>
          The draw hasn&rsquo;t been entered for this night yet.
        </p>
      )}

      {!loadError && rounds.length === 0 && finalsSlots.length > 0 && (
        <>
          <p className="hint" style={{ textAlign: "center" }}>
            Qualifiers confirmed so far &mdash; the lineup fills in as each qualifying night finishes.
          </p>
          {finalsSlots.map((p, i) => (
            <div key={i} className="card" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>{i + 1}.</span>
              <span>{p ? p.name : ""}</span>
            </div>
          ))}
        </>
      )}

      {!loadError && rounds.map(([round, roundMatches]) => (
        <section key={round}>
          <div className="round-heading">
            <h2>{roundLabel(night?.kind ?? "qualifier", round, roundMatches.length)}</h2>
            <span className="count">{roundMatches.length} match{roundMatches.length === 1 ? "" : "es"}</span>
          </div>
          {roundMatches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              players={players}
              highlighted={highlightPlayerId != null && (m.player_a_id === highlightPlayerId || m.player_b_id === highlightPlayerId)}
            />
          ))}
        </section>
      ))}

      {!loadError && qualifiers.length > 0 && (
        <section>
          <div className="round-heading">
            <h2>Advancing to finals day</h2>
          </div>
          <p className="hint" style={{ textAlign: "center" }}>
            Tap a name to highlight their results from tonight.
          </p>
          {qualifiers.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`card qualifier-row ${highlightPlayerId === p.id ? "selected" : ""}`}
              onClick={() => setHighlightPlayerId((current) => (current === p.id ? null : p.id))}
            >
              <span>{p.name}</span>
              <strong>{p.finals_number ?? ""}</strong>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function MatchCard({
  match,
  players,
  highlighted,
}: {
  match: MatchRow;
  players: Record<string, Player>;
  highlighted?: boolean;
}) {
  const isBye = Boolean(match.player_a_id) && !match.player_b_id && match.status === "complete";
  const nameA = match.player_a_id ? players[match.player_a_id]?.name ?? "TBC" : "TBC";
  const nameB = match.player_b_id ? players[match.player_b_id]?.name ?? "TBC" : isBye ? "BYE" : "TBC";
  const winnerA = Boolean(match.winner_id) && match.winner_id === match.player_a_id;
  const winnerB = Boolean(match.winner_id) && match.winner_id === match.player_b_id;

  return (
    <div className={`card match ${match.status === "complete" ? "complete" : ""} ${highlighted ? "highlighted" : ""}`}>
      <div className="players">
        <div className={`player-row ${winnerA ? "winner" : ""}`}>
          <span className="name">{nameA}</span>
          <span className="score">{match.player_a_id ? match.score_a : "\u2013"}</span>
        </div>
        <hr className="divider" />
        <div className={`player-row ${winnerB ? "winner" : ""}`}>
          <span className="name">{nameB}</span>
          <span className="score">{match.player_b_id ? match.score_b : "\u2013"}</span>
        </div>
      </div>
      <span className={`status-pill ${match.status}`}>
        {match.status === "live" && <span className="live-dot" />}
        {isBye ? "bye" : match.status}
      </span>
    </div>
  );
}
