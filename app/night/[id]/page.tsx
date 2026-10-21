"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { buildFinalsSlots, computeNightStatus, isWalkover, roundLabel } from "@/lib/bracket";
import { roundOneTime, type TimeSlot } from "@/lib/timeSlots";
import { originalDateLabel, postponedLabel } from "@/lib/venues";
import { sessionTimes, sessionTitle, shortDate, timeOfDay } from "@/lib/publicCompetitions";
import { startViewerPings } from "@/lib/viewerLog";
import NightNav, { splitNightName } from "@/components/NightNav";
import Brand from "@/components/Brand";
import { SponsorStrip, type SponsorShown } from "@/components/Sponsors";
import Avatar from "@/components/Avatar";
import PlayerName from "@/components/PlayerName";
import MatchCard from "@/components/MatchCard";
import BracketTree from "@/components/BracketTree";
import type { MatchRow, Night, Player, Venue } from "@/lib/types";
import { SITE_NAME } from "@/lib/site";
import PublicFooter from "@/components/PublicFooter";
import FindYourMatch from "@/components/FindYourMatch";
import SiteHeader from "@/components/SiteHeader";
import VenueCard from "@/components/VenueCard";

export default function NightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: nightId } = use(params);
  const [night, setNight] = useState<Night | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [venue, setVenue] = useState<Venue | null>(null);
  // The competition this session belongs to, for the back link and banner
  const [competition, setCompetition] = useState<{
    name: string;
    year: number;
    slug: string;
    latest: boolean;
    sponsors: SponsorShown[];
    finalsSize: number;
  } | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);

  useEffect(() => {
    document.title = night ? `${night.name} · ${SITE_NAME}` : `${SITE_NAME}`;
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

      // First-round start times (2027 sessions). Not there on a database
      // that hasn't been moved over yet - that's fine, there are none.
      const { data: slotData } = await supabase
        .from("time_slots")
        .select("from_number, to_number, start_time")
        .eq("night_id", nightId);
      if (!cancelled) setTimeSlots((slotData ?? []) as TimeSlot[]);

      // Where it's played: this session's own venue, or the competition's
      let venueId = nightData?.venue_id ?? null;
      if (nightData?.competition_id) {
        const { data: comp } = await supabase
          .from("competitions")
          .select(
            "venue_id, year, series_id, format, draw_size, series:series_id(name, slug), sponsors:competition_sponsors(*)"
          )
          .eq("id", nightData.competition_id)
          .single();
        if (comp) {
          venueId = venueId ?? comp.venue_id ?? null;
          const series = comp.series as unknown as { name: string; slug: string };
          const { data: years } = await supabase.from("competitions").select("year").eq("series_id", comp.series_id);
          const latest = Math.max(...(years ?? []).map((y) => y.year), comp.year) === comp.year;
          const sponsors = [
            ...((comp.sponsors as unknown as (SponsorShown & { position: number })[]) ?? []),
          ]
            .sort((a, b) => a.position - b.position)
            .map((s) => ({ name: s.name, url: s.url ?? null, logo_url: s.logo_url ?? null }));
          const finalsSize = comp.format === "qualifying_and_finals" && comp.draw_size ? comp.draw_size : 16;
          if (!cancelled)
            setCompetition({ name: series.name, year: comp.year, slug: series.slug, latest, sponsors, finalsSize });
        }
      }
      if (venueId) {
        const { data: venueData } = await supabase.from("venues").select("*").eq("id", venueId).single();
        if (!cancelled) setVenue((venueData as Venue | null) ?? null);
      }
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
  // Only while the night is still to play or in play - once every match is
  // finished there's nothing live to watch, and the log for the night is
  // already complete. Waits for the first load so a finished night never
  // pings at all. If a match is reopened, pinging starts again.
  const nightFinished = matches.length > 0 && computeNightStatus(matches) === "complete";
  useEffect(() => {
    if (!night || nightFinished) return;
    return startViewerPings(nightId);
  }, [nightId, Boolean(night), nightFinished]);

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
    (m) => m.status === "live" || (m.status === "complete" && m.player_a_id && m.player_b_id && !isWalkover(m))
  );

  // "10:45" on each first-round match not yet started; "Time to follow" on
  // later ones - only when the session has start times at all
  const startTimes = useMemo(() => {
    const times: Record<string, string> = {};
    if (timeSlots.length === 0) return times;
    for (const m of matches) {
      if (m.status !== "upcoming") continue;
      times[m.id] = m.round === 1 ? (roundOneTime(timeSlots, m.slot) ?? "Time to follow") : "Time to follow";
    }
    return times;
  }, [matches, timeSlots]);

  // Finals Day, a single day and a final are knockouts to a champion, with
  // a bracket view; a qualifying session sends its last four through
  const knockout = night != null && night.kind !== "qualifier";

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
    return buildFinalsSlots(Object.values(players), competition?.finalsSize);
  }, [players, night, showDraw, competition]);

  // Deliberately alphabetical, not sort_order - sort_order is what the
  // admin drags to set round-1 pairing, and showing that live would leak
  // every drag while they're still arranging it. Alphabetical order never
  // changes as they work, so nothing here hints at the pairing until the
  // real draw is published.
  const qualifierPlayers = useMemo(() => {
    if (!night || night.kind === "finals" || showDraw) return [];
    return Object.values(players)
      .filter((p) => !p.is_bye)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, night, showDraw]);

  const champion = useMemo(() => {
    if (!night || !knockout || !showDraw) return null;
    const [, lastRoundMatches] = rounds[rounds.length - 1];
    if (lastRoundMatches.length !== 1) return null;
    const finalMatch = lastRoundMatches[0];
    if (finalMatch.status !== "complete" || !finalMatch.winner_id) return null;
    return players[finalMatch.winner_id] ?? null;
  }, [night, knockout, rounds, players, showDraw]);

  const titleSplit = night ? splitNightName(night) : null;
  // The title shrinks to a slim strip, like the sponsor line, whenever
  // there's a list below it worth the space. Over the field of players
  // before the draw it slims right down to just the start time - the
  // highlighted night tab already says which night it is.
  const showField = !showDraw && (finalsSlots.length > 0 || qualifierPlayers.length > 0);
  const slimHeader = showDraw || showField;
  // Finals Day's strip shows its date, since there's no date in the Finals
  // tab: "Saturday 17th October" over the qualifiers, then "Saturday 17th
  // Oct" once the draw is up.
  const finalsDraw = night?.kind === "finals" && showDraw;
  const finalsField = night?.kind === "finals" && showField;
  // A qualifying night's draw page drops the strip altogether - the night
  // tab says which night it is - leaving only the watcher count.
  const qualifierDraw = night?.kind === "qualifier" && showDraw;
  const hideName = (showField && !finalsField) || qualifierDraw;

  return (
    <div className="page page-photo">
      <div className="public-background" aria-hidden="true" />
      <SiteHeader
        compact
        back={competition ? (competition.latest ? `/${competition.slug}` : `/${competition.slug}-${competition.year}`) : "/"}
      />
      {/* The competition's own sponsors; a night from before the 2027 move
          keeps the October Singles sponsor it always had */}
      {competition ? (
        <SponsorStrip sponsors={competition.sponsors} />
      ) : (
        night && !night.competition_id && <Brand variant="slim" />
      )}

      <NightNav currentId={nightId} hideSingle={Boolean(competition)} />

      <div className="night-header-card">
        {competition && night ? (
          // A competition's session: one line - which session, when, and how
          // many are watching. The back link above already names the competition.
          <div className={`night-header-simple ${night.kind === "finals" ? "night-header-simple-finals" : ""}`}>
            <p className="night-header-simple-comp">
              {competition.name} {competition.year}
            </p>
            <h1>
              <strong>{sessionTitle(night as Parameters<typeof sessionTitle>[0])}</strong>{" "}
              &middot;{" "}
              {[
                night.date ? shortDate(night.date) : "Date to be confirmed",
                !playStarted ? sessionTimes(night) : null,
                showDraw && viewerCount > 0 ? `${viewerCount} watching now` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </h1>
          </div>
        ) : (
          <>
          <div
            className={`night-header-title ${slimHeader ? "night-header-title-slim" : ""} ${
              showField ? "night-header-title-field" : ""
            } ${night?.kind === "finals" ? "night-header-title-finals" : ""} ${
              qualifierDraw ? "night-header-title-bare" : ""
            }`}
          >
            {/* Kept for screen readers wherever it's hidden on screen. */}
            <span className={hideName ? "visually-hidden" : "night-header-name"}>
              {titleSplit && (finalsDraw || finalsField) ? (
                <>
                  <span className="visually-hidden">{titleSplit.day}</span>
                  <span className="night-header-day">
                    {finalsDraw ? shortenMonth(titleSplit.rest) : titleSplit.rest}
                  </span>
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
            {!loadError && night && !playStarted && !showDraw && !finalsField && headerTimes(night, showField) && (
              <span className="night-header-times">{headerTimes(night, showField)}</span>
            )}
            {/* Only once the draw is up - before that it's the field of
                players that needs the room. Finals Day waits for the first
                scores, so the strip stays one line until play begins. */}
            {!loadError && showDraw && (night?.kind !== "finals" || playStarted) && viewerCount > 0 && (
              <span className="night-header-viewers">{viewerCount} watching now</span>
            )}
          </div>
          </>
        )}

        {loadError && (
          <p className="night-header-hint">
            Couldn&rsquo;t load &ndash; check your signal and refresh.
          </p>
        )}

        {!loadError && connectionLost && (
          <p className="night-header-hint">Live updates paused, reconnecting&hellip;</p>
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

      {!loadError && night && postponedLabel(night) && (
        <div className="postponed-banner" role="status">
          <strong>{postponedLabel(night)}</strong>
          {originalDateLabel(night) && <span>{originalDateLabel(night)}</span>}
        </div>
      )}

      {!loadError && champion && (
        <div className="champion-banner">
          <PlayerName name={champion.name} />
          <span className="hint">
            {competition ? `${competition.name} ${competition.year} champion` : night?.kind === "finals" ? "October Singles champion" : "Champion"}
          </span>
        </div>
      )}

      {!loadError && rounds.length === 0 && finalsSlots.length === 0 && qualifierPlayers.length === 0 && (
        <p className="quiet-line" style={{ textAlign: "center" }}>
          No draw yet
        </p>
      )}

      {!loadError && finalsSlots.length > 0 && (
        <div className="roster-list">
          {finalsSlots.map((p, i) => (
            <div key={i} className={`roster-row ${p ? "" : "roster-row-empty"}`}>
              <span className="roster-number">{i + 1}</span>
              {p && <Avatar name={p.name} />}
              {p ? <PlayerName name={p.name} className="roster-name" /> : <span className="roster-name">TBC</span>}
            </div>
          ))}
        </div>
      )}

      {!loadError && qualifierPlayers.length > 0 && (
        <div className="roster-list">
          {qualifierPlayers.map((p) => (
            <div key={p.id} className="roster-row">
              <Avatar name={p.name} />
              <PlayerName name={p.name} className="roster-name" />
            </div>
          ))}
        </div>
      )}

      {!loadError && showDraw && Object.keys(players).length > 0 && (
        <FindYourMatch
          players={players}
          matches={matches}
          roundName={(m) =>
            roundLabel(night?.kind ?? "qualifier", m.round, rounds.find(([r]) => r === m.round)?.[1].length ?? 1)
          }
          startTime={(m) => (startTimes[m.id] && startTimes[m.id] !== "Time to follow" ? startTimes[m.id] : null)}
          onShow={(playerId, matchId) => {
            setHighlightPlayerId(playerId);
            // Scroll once the highlight has been drawn
            setTimeout(() => {
              document.querySelector(`[data-match="${matchId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 50);
          }}
        />
      )}

      {!loadError && knockout && showDraw && (
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

      {!loadError && night && knockout && showDraw && viewMode === "bracket" ? (
        <BracketTree
          rounds={rounds}
          night={night}
          players={players}
          drawNumbers={drawNumbers}
          highlightPlayerId={highlightPlayerId}
          onSelectPlayer={toggleHighlight}
          champion={champion}
          startTimes={startTimes}
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
                  startTime={startTimes[m.id]}
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
                  {p ? <PlayerName name={p.name} /> : <span className="name">To be decided</span>}
                </span>
                {p?.finals_number != null && <span className="finals-number">{p.finals_number}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {!loadError && venue && <VenueCard venue={venue} />}

      <PublicFooter />
    </div>
  );
}

// The times under the title: the session's own practice and start times.
// Over the field of players it's just the start and "Draw to follow". A night
// from before the 2027 move has no times stored, so it keeps the October
// Singles times it always showed.
function headerTimes(night: Night, overField: boolean): string | null {
  if (!night.competition_id && !night.start_time) {
    if (overField) return "Start 7pm · Draw to follow";
    return night.kind === "finals" ? "Practice 12:30pm · Start 1pm" : "Practice 6:30pm · Start 7pm";
  }
  if (overField) {
    const start = timeOfDay(night.start_time ?? null);
    return start ? `Start ${start} · Draw to follow` : "Draw to follow";
  }
  return sessionTimes(night);
}

const MONTHS =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

// "Saturday 17th October" -> "Saturday 17th Oct"
function shortenMonth(date: string): string {
  return date.replace(MONTHS, (month) => month.slice(0, 3));
}
