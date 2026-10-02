"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { buildFinalsSlots, roundLabel } from "@/lib/bracket";
import { startViewerPings } from "@/lib/viewerLog";
import NightNav, { splitNightName } from "@/components/NightNav";
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
    document.title = night ? `${night.name} · Penwortham Singles` : "Penwortham Singles";
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

  // Feeds the admin's viewer log - see lib/viewerLog.ts.
  useEffect(() => startViewerPings(nightId), [nightId]);

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

  // Each player's draw position, 1-16, read off the first round: slot 0 is
  // 1 v 2, slot 1 is 3 v 4, and so on. Same on qualifying nights and Finals
  // Day, so the number stays with a player as they move through the draw.
  const drawNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    if (rounds.length === 0) return numbers;
    for (const m of rounds[0][1]) {
      if (m.player_a_id) numbers[m.player_a_id] = m.slot * 2 + 1;
      if (m.player_b_id) numbers[m.player_b_id] = m.slot * 2 + 2;
    }
    return numbers;
  }, [rounds]);

  const liveMatches = useMemo(() => matches.filter((m) => m.status === "live"), [matches]);
  const firstLiveMatchId = liveMatches.length > 0 ? liveMatches[0].id : null;
  // Byes and no-shows are marked complete before a bowl is played, so only
  // a live match or a finished two-player match counts as play having begun.
  const playStarted = matches.some(
    (m) => m.status === "live" || (m.status === "complete" && m.player_a_id && m.player_b_id)
  );

  const drawPublished = night?.draw_published ?? true;
  // Finals day updates live as it happens, same as before this feature
  // existed - only a qualifying night's draw waits on an explicit publish,
  // since that's the one the admin privately rearranges beforehand.
  const showDraw = rounds.length > 0 && (night?.kind === "finals" || drawPublished);

  // Always as many slots as the last round has matches (one qualifier per
  // match), even before they're all decided - an undecided slot renders
  // as null and shows a "to be decided" placeholder instead of just not
  // being there yet.
  const qualifiers = useMemo(() => {
    if (!night || night.kind !== "qualifier" || rounds.length === 0 || !drawPublished) return [];
    const lastRoundMatches = rounds[rounds.length - 1][1];
    return [...lastRoundMatches]
      .sort((a, b) => a.slot - b.slot)
      .map((m) => (m.status === "complete" && m.winner_id ? players[m.winner_id] ?? null : null));
  }, [rounds, players, night, drawPublished]);

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

  const titleSplit = night ? splitNightName(night) : null;
  // The title shrinks to a slim strip, like the sponsor line, whenever
  // there's a list below it worth the space. Over the field of players
  // before the draw it slims right down to just the start time - the
  // highlighted night tab already says which night it is.
  const showField = !showDraw && (finalsSlots.length > 0 || qualifierPlayers.length > 0);
  const slimHeader = showDraw || showField;
  // Finals Day's draw page just reads "Saturday 17th Oct · 1pm start" - the
  // gold Finals tab already says which day it is.
  const finalsDraw = night?.kind === "finals" && showDraw;

  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <Link href="/" className="page-back-link">
        <span aria-hidden="true">&lsaquo;</span> Home
      </Link>
      <Brand variant="slim" />

      <NightNav currentId={nightId} />

      <div className="night-header-card">
        <div
          className={`night-header-title ${slimHeader ? "night-header-title-slim" : ""} ${
            showField ? "night-header-title-field" : ""
          } ${night?.kind === "finals" ? "night-header-title-finals" : ""}`}
        >
          {/* Kept for screen readers over the field list, where it's hidden. */}
          <span className={showField ? "visually-hidden" : "night-header-name"}>
            {titleSplit && finalsDraw ? (
              <>
                <span className="visually-hidden">{titleSplit.day}</span>
                <span className="night-header-day">{shortenMonth(titleSplit.rest)}</span>
              </>
            ) : titleSplit ? (
              <>
                <span className="night-header-day">{titleSplit.day}</span>
                <span className="night-header-date">{titleSplit.rest}</span>
              </>
            ) : (
              <span className="night-header-day">{night?.name ?? "Loading…"}</span>
            )}
          </span>
          {!loadError && night && !playStarted && (
            <span className="night-header-times">
              {showField
                ? `Start ${night.kind === "finals" ? "1pm" : "7pm"}${
                    night.kind === "qualifier" ? " · Draw to follow" : ""
                  }`
                : finalsDraw
                  ? "· 1pm start"
                  : "Practice 6:30pm · Start 7pm"}
            </span>
          )}
          {/* Only once the draw is up - before that it's the field of
              players that needs the room. Finals Day waits for the first
              scores, so the strip stays one line until play begins. */}
          {!loadError && showDraw && (night?.kind !== "finals" || playStarted) && viewerCount > 0 && (
            <span className="night-header-viewers">{viewerCount} watching now</span>
          )}
        </div>

        {loadError && (
          <p className="night-header-hint">
            Having trouble loading this page? Check your connection and try refreshing.
          </p>
        )}

        {!loadError && connectionLost && (
          <p className="night-header-hint">Live updates paused, reconnecting&hellip;</p>
        )}

        {!loadError && night?.kind === "finals" && finalsSlots.length > 0 && (
          <p className="night-header-hint">Qualifiers so far</p>
        )}

        {!loadError && viewMode === "list" && firstLiveMatchId && (
          <p style={{ margin: "14px 0 0" }}>
            <a href="#jump-to-live" className="link-button jump-to-live-link">
              <span className="live-dot" />
              Jump to live matches
            </a>
          </p>
        )}
      </div>

      {!loadError && champion && (
        <div className="champion-banner">
          <span className="name">{champion.name}</span>
          <span className="hint">October Singles champion</span>
        </div>
      )}

      {!loadError && rounds.length === 0 && finalsSlots.length === 0 && qualifierPlayers.length === 0 && (
        <p className="empty" style={{ textAlign: "center" }}>
          No draw yet.
        </p>
      )}

      {!loadError && finalsSlots.length > 0 && (
        <div className="roster-list">
          {finalsSlots.map((p, i) => (
            <div key={i} className={`roster-row ${p ? "" : "roster-row-empty"}`}>
              <span className="roster-number">{i + 1}</span>
              {p && <Avatar name={p.name} />}
              <span className="roster-name">{p ? p.name : "TBC"}</span>
            </div>
          ))}
        </div>
      )}

      {!loadError && qualifierPlayers.length > 0 && (
        <div className="roster-list">
          {qualifierPlayers.map((p) => (
            <div key={p.id} className="roster-row">
              <Avatar name={p.name} />
              <span className="roster-name">{p.name}</span>
            </div>
          ))}
        </div>
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
          drawNumbers={drawNumbers}
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
            <div className="draw-sheet">
              {roundMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  id={m.id === firstLiveMatchId ? "jump-to-live" : undefined}
                  match={m}
                  players={players}
                  drawNumbers={drawNumbers}
                  highlightPlayerId={highlightPlayerId}
                  onSelectPlayer={toggleHighlight}
                  // Score history is admin-only for now; set back to
                  // night?.kind === "finals" to show it publicly again.
                  historyEnabled={false}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {!loadError && qualifiers.length > 0 && (
        <section>
          <div className="round-heading">
            <h2>Through to Finals Day</h2>
          </div>
          <div className="draw-sheet">
            {qualifiers.some((p) => p?.finals_number != null) && (
              <div className="draw-sheet-header">
                <span>Finals draw</span>
              </div>
            )}
            {qualifiers.map((p, i) => (
              <button
                key={p?.id ?? `slot-${i}`}
                type="button"
                className={`qualifier-row ${p && highlightPlayerId === p.id ? "selected" : ""} ${
                  p ? "" : "qualifier-row-empty"
                }`}
                onClick={() => p && toggleHighlight(p.id)}
                disabled={!p}
              >
                <span className="name-cell">
                  <span className="name">{p ? p.name : "To be decided"}</span>
                </span>
                {p?.finals_number != null && <span className="finals-number">{p.finals_number}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const MONTHS =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

// "Saturday 17th October" -> "Saturday 17th Oct"
function shortenMonth(date: string): string {
  return date.replace(MONTHS, (month) => month.slice(0, 3));
}
