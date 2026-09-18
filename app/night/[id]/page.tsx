"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { buildFinalsSlots, roundLabel } from "@/lib/bracket";
import NightNav from "@/components/NightNav";
import Brand from "@/components/Brand";
import Avatar from "@/components/Avatar";
import MatchCard from "@/components/MatchCard";
import BracketTree from "@/components/BracketTree";
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

    const channel = supabase
      .channel(`night-${nightId}`, { config: { presence: { key: crypto.randomUUID() } } })
      .on("presence", { event: "sync" }, () => {
        setViewerCount(Object.keys(channel.presenceState()).length);
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "nights", filter: `id=eq.${nightId}` },
        (payload) => {
          setNight(payload.new as Night);
        }
      )
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
  const [viewMode, setViewMode] = useState<"list" | "bracket">("list");

  function toggleHighlight(playerId: string) {
    setHighlightPlayerId((current) => (current === playerId ? null : playerId));
  }

  const rounds = useMemo(() => {
    const byRound = new Map<number, MatchRow[]>();
    for (const m of matches) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round)!.push(m);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1][0] : 0;
  const drawPublished = night?.draw_published ?? true;
  // Finals day updates live as it happens, same as before this feature
  // existed - only a qualifying night's draw waits on an explicit publish,
  // since that's the one the admin privately rearranges beforehand.
  const showDraw = rounds.length > 0 && (night?.kind === "finals" || drawPublished);

  const qualifiers = useMemo(() => {
    if (!night || night.kind !== "qualifier" || lastRound === 0 || !drawPublished) return [];
    return matches
      .filter((m) => m.round === lastRound && m.status === "complete" && m.winner_id)
      .sort((a, b) => a.slot - b.slot)
      .map((m) => (m.winner_id ? players[m.winner_id] : undefined))
      .filter((p): p is Player => Boolean(p));
  }, [matches, players, night, lastRound, drawPublished]);

  // Doubles as the fallback view whenever the real bracket shouldn't show
  // yet - either it hasn't been generated, or it has but the admin hasn't
  // published it.
  const finalsSlots = useMemo(() => {
    if (!night || night.kind !== "finals" || showDraw) return [];
    return buildFinalsSlots(Object.values(players));
  }, [players, night, showDraw]);

  // Deliberately alphabetical, not sort_order - sort_order is what the
  // admin drags to set round-1 pairing, and showing that live would leak
  // every drag while they're still arranging it. Alphabetical order never
  // changes as they work, so nothing here hints at the pairing until the
  // real draw is published.
  const qualifierPlayers = useMemo(() => {
    if (!night || night.kind !== "qualifier" || showDraw) return [];
    return Object.values(players)
      .filter((p) => !p.is_bye)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, night, showDraw]);

  const champion = useMemo(() => {
    if (!night || night.kind !== "finals" || !showDraw) return null;
    const [, lastRoundMatches] = rounds[rounds.length - 1];
    if (lastRoundMatches.length !== 1) return null;
    const finalMatch = lastRoundMatches[0];
    if (finalMatch.status !== "complete" || !finalMatch.winner_id) return null;
    return players[finalMatch.winner_id] ?? null;
  }, [night, rounds, players, showDraw]);

  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <div className="top-bar">
        <Brand />
        <nav>
          <Link href="/">Home</Link>
        </nav>
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

      {!loadError && rounds.length === 0 && finalsSlots.length === 0 && qualifierPlayers.length === 0 && (
        <p className="empty" style={{ textAlign: "center" }}>
          The draw hasn&rsquo;t been entered for this night yet.
        </p>
      )}

      {!loadError && finalsSlots.length > 0 && (
        <>
          <p className="hint" style={{ textAlign: "center" }}>
            Qualifiers confirmed so far &mdash; the lineup fills in as each qualifying night finishes.
          </p>
          <div className="roster-list">
            {finalsSlots.map((p, i) => (
              <div key={i} className={`roster-row ${p ? "" : "roster-row-empty"}`}>
                <span className="roster-number">{i + 1}</span>
                {p && <Avatar name={p.name} />}
                <span className="roster-name">{p ? p.name : "TBC"}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!loadError && qualifierPlayers.length > 0 && (
        <>
          <p className="hint" style={{ textAlign: "center" }}>
            {qualifierPlayers.length} player{qualifierPlayers.length === 1 ? "" : "s"} entered &mdash; the draw will
            appear here once it&rsquo;s ready.
          </p>
          <div className="roster-list">
            {qualifierPlayers.map((p) => (
              <div key={p.id} className="roster-row">
                <Avatar name={p.name} />
                <span className="roster-name">{p.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!loadError && night?.kind === "finals" && showDraw && (
        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === "list" ? "" : "secondary"}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
          <button
            type="button"
            className={viewMode === "bracket" ? "" : "secondary"}
            onClick={() => setViewMode("bracket")}
          >
            Bracket
          </button>
        </div>
      )}

      {!loadError && night?.kind === "finals" && showDraw && viewMode === "bracket" ? (
        <BracketTree
          rounds={rounds}
          night={night}
          players={players}
          highlightPlayerId={highlightPlayerId}
          onSelectPlayer={toggleHighlight}
          champion={champion}
        />
      ) : (
        !loadError &&
        showDraw &&
        rounds.map(([round, roundMatches]) => (
          <section key={round}>
            <div className="round-heading">
              <h2>{roundLabel(night?.kind ?? "qualifier", round, roundMatches.length)}</h2>
            </div>
            {roundMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                players={players}
                highlightPlayerId={highlightPlayerId}
                onSelectPlayer={toggleHighlight}
                historyEnabled={night?.kind === "finals"}
              />
            ))}
          </section>
        ))
      )}

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
              onClick={() => toggleHighlight(p.id)}
            >
              <span className="name-cell">
                <Avatar name={p.name} />
                <span className="name">{p.name}</span>
              </span>
              <strong>{p.finals_number ?? ""}</strong>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
