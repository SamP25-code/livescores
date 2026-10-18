"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/lib/supabaseClient";
import {
  addEntriesToSession,
  addPlayer,
  adjustScore,
  completeMatch,
  deletePlayer,
  ensureFinalsBracketGenerated,
  generateBracket,
  getFinalsRoster,
  makeDraw,
  markNoShow,
  renamePlayer,
  reopenMatch,
  reorderPlayers,
  replaceInDraw,
  resetBracket,
  saveResult,
  saveTimeSlots,
  setDrawNumbers,
  setDrawPublished,
  setFinalsNumber,
  setFinalsPlayerSeed,
  setMatchTime,
  setPlayerBye,
  syncSessionPlaces,
  undoNoShow,
} from "@/lib/adminActions";
import {
  buildFinalsSlots,
  computeNightStatus,
  isMatchComplete,
  isWalkover,
  nextPowerOfTwo,
  roundLabel,
} from "@/lib/bracket";
import { drawSizeFor, randomDrawNumbers } from "@/lib/draw";
import { roundOneTime, type TimeSlot } from "@/lib/timeSlots";
import { useAdminRole } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { deleteEntry, listClubs, listEntries, type EntryWithPeople } from "@/lib/peopleApi";
import Avatar from "@/components/Avatar";
import PlayerName from "@/components/PlayerName";
import SessionEntryAdder from "@/components/SessionEntryAdder";
import DrawMaker from "@/components/DrawMaker";
import TimeSlotsEditor from "@/components/TimeSlotsEditor";
import ChangePeopleControl from "@/components/ChangePeopleControl";
import FinalsNumberPicker from "@/components/FinalsNumberPicker";
import FlashingScore from "@/components/FlashingScore";
import MatchHistory from "@/components/MatchHistory";
import ViewerLog from "@/components/ViewerLog";
import type { Competition, MatchRow, Night, Organiser, Player } from "@/lib/types";

type CompetitionInfo = Pick<Competition, "id" | "year" | "team_size" | "target_score" | "scoring_style"> & {
  series: { name: string };
};

// A session in a 2027 competition: the competition's settings, its entries,
// this session's start times, and the clubs (for adding a replacement).
// Loaded when the page opens and after changes to them - not on every
// background refresh.
type CompetitionContext = {
  competition: CompetitionInfo;
  entries: EntryWithPeople[];
  timeSlots: TimeSlot[];
  clubs: Organiser[];
};

async function loadCompetitionContext(competitionId: string, nightId: string): Promise<CompetitionContext> {
  const [{ data: competition, error }, entries, { data: timeSlots, error: slotsError }, clubs] = await Promise.all([
    supabase
      .from("competitions")
      .select("id, year, team_size, target_score, scoring_style, series:series_id(name)")
      .eq("id", competitionId)
      .single(),
    listEntries(competitionId),
    supabase.from("time_slots").select("from_number, to_number, start_time").eq("night_id", nightId),
    listClubs(),
  ]);
  if (error) throw error;
  if (slotsError) throw slotsError;
  return {
    competition: competition as unknown as CompetitionInfo,
    entries,
    timeSlots: (timeSlots ?? []) as TimeSlot[],
    clubs,
  };
}

export default function AdminNightPage({ params }: { params: Promise<{ id: string }> }) {
  const role = useAdminRole();
  const { id: nightId } = use(params);
  const [night, setNight] = useState<Night | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [finalsRoster, setFinalsRoster] = useState<Player[]>([]);
  const [context, setContext] = useState<CompetitionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingMatchIds, setPendingMatchIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = night ? `${night.name} · Admin · Penwortham Singles` : "Admin · Penwortham Singles";
  }, [night]);

  // What the last refresh found, for the background checks below without
  // re-running them on every render.
  const kindRef = useRef<Night["kind"] | null>(null);
  const completeRef = useRef(false);

  async function refresh() {
    // The finals lineup is only needed on a qualifying night (for its
    // "Through to Finals Day" picker); Finals Day itself shows its own
    // players, so skip those two lookups there.
    const needRoster = kindRef.current !== "finals";
    const [{ data: nightData }, { data: playerData }, { data: matchData }, roster] = await Promise.all([
      supabase.from("nights").select("*").eq("id", nightId).single(),
      supabase.from("players").select("*").eq("night_id", nightId).order("sort_order").order("created_at"),
      supabase.from("matches").select("*").eq("night_id", nightId).order("round").order("slot"),
      needRoster ? getFinalsRoster(nightId) : Promise.resolve(undefined),
    ]);
    kindRef.current = nightData?.kind ?? null;
    completeRef.current = (matchData ?? []).length > 0 && computeNightStatus(matchData ?? []) === "complete";
    setNight(nightData ?? null);
    setPlayers(playerData ?? []);
    if (roster !== undefined) setFinalsRoster(roster?.players ?? []);

    if (nightData?.kind === "finals" && (matchData ?? []).length === 0) {
      try {
        await ensureFinalsBracketGenerated(nightData.id);
        const { data: freshMatches } = await supabase
          .from("matches")
          .select("*")
          .eq("night_id", nightId)
          .order("round")
          .order("slot");
        setMatches(freshMatches ?? []);
        return;
      } catch {}
    }

    setMatches(matchData ?? []);
  }

  useEffect(() => {
    refresh();
  }, [nightId]);

  const competitionId = night?.competition_id ?? null;
  async function reloadContext() {
    if (!competitionId) return;
    try {
      setContext(await loadCompetitionContext(competitionId, nightId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    reloadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, nightId]);

  // A 2027 session: everyone entered is in the draw, with no step to add
  // them. Until the draw is made, opening the page brings its places up to
  // date with the entries (normally already done when they were entered).
  const newFlow = Boolean(competitionId);
  useEffect(() => {
    if (!context || role !== "owner" || night?.kind === "finals" || matches.length > 0) return;
    syncSessionPlaces(nightId)
      .then(refresh)
      .catch((err) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, role]);

  // For changes to entries, places or start times: refresh those too
  function withContextRefresh<Args extends unknown[]>(fn: (...args: Args) => Promise<void>) {
    return withErrorHandling(async (...args: Args) => {
      await fn(...args);
      await reloadContext();
    });
  }

  // Picks up changes made from anywhere else - another admin's browser, or
  // a scorer working a different match on the same night - so this page
  // never sits on a stale view of what's actually been scored. Backed up
  // by a plain poll too: realtime delivery between two authenticated admin
  // sessions has proven less reliable in practice than to the public page,
  // so this corrects the view even if a change event never arrives.
  //
  // Kept light on requests (Supabase's free plan caps its request logs):
  // a burst of change events (several score taps) becomes one refresh;
  // the backup poll is every 15 seconds and only while the page is on
  // screen, catching up straight away when it comes back; and a finished
  // night doesn't poll at all - it's done, and a change event still
  // refreshes it if a match is reopened.
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    function refreshSoon() {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        refresh();
      }, 500);
    }

    const channel = supabase
      .channel(`admin-night-${nightId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `night_id=eq.${nightId}` },
        refreshSoon
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `night_id=eq.${nightId}` },
        refreshSoon
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nights", filter: `id=eq.${nightId}` },
        refreshSoon
      )
      .subscribe();

    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && !completeRef.current) refresh();
    }, 15_000);

    function onVisible() {
      if (document.visibilityState === "visible") refreshSoon();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      if (pending) clearTimeout(pending);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightId]);

  function withErrorHandling<Args extends unknown[]>(fn: (...args: Args) => Promise<void>) {
    return async (...args: Args) => {
      setError(null);
      try {
        await fn(...args);
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      }
    };
  }

  function handleAdjust(match: MatchRow, side: "a" | "b", delta: number) {
    if (pendingMatchIds.has(match.id)) return;
    setError(null);
    setPendingMatchIds((prev) => new Set(prev).add(match.id));
    (async () => {
      try {
        await adjustScore(match, side, delta);
        await refresh();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setPendingMatchIds((prev) => {
          const next = new Set(prev);
          next.delete(match.id);
          return next;
        });
      }
    })();
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
  const isFinals = night?.kind === "finals";
  // Start times are only for one-day competitions (staggered first round);
  // qualifying sessions and Finals Day just start at the session's time
  const oneDay = night?.kind === "single_day";
  // A qualifying session records results only; Finals Day is scored live; a
  // single day or a final follows the competition's setting.
  const resultsOnly =
    night?.kind === "qualifier" || (!isFinals && context?.competition.scoring_style === "results");

  const inThisSession = useMemo(
    () => new Set(players.map((p) => p.entry_id).filter((id): id is string => Boolean(id))),
    [players]
  );
  const entryAdder = context && (
    <SessionEntryAdder
      competitionId={context.competition.id}
      pairs={context.competition.team_size === 2}
      entries={context.entries}
      problemFor={(entryId) => (inThisSession.has(entryId) ? "Already in this draw" : null)}
      onAdd={withContextRefresh((ids: string[]) => addEntriesToSession(nightId, ids))}
    />
  );

  const orderedPlayers = useMemo(() => {
    if (!isFinals) return players;
    return [...players].sort((a, b) => {
      if (a.seed == null) return 1;
      if (b.seed == null) return -1;
      return a.seed - b.seed;
    });
  }, [players, isFinals]);

  const playerNames = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name])), [players]);

  const qualifiers = useMemo(() => {
    if (!night || night.kind !== "qualifier" || lastRound === 0) return [];
    return matches
      .filter((m) => m.round === lastRound && m.status === "complete" && m.winner_id)
      .sort((a, b) => a.slot - b.slot)
      .map((m) => players.find((p) => p.id === m.winner_id))
      .filter((p): p is Player => Boolean(p));
  }, [matches, players, night, lastRound]);

  const finalsOccupancy = isFinals ? players : finalsRoster;
  const finalsSlots = useMemo(() => buildFinalsSlots(finalsOccupancy), [finalsOccupancy]);
  const bracketExists = matches.length > 0;

  const entriesById = useMemo(() => new Map((context?.entries ?? []).map((e) => [e.id, e])), [context]);
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const entryOf = (playerId: string | null) => {
    const entryId = playerId ? playerById.get(playerId)?.entry_id : null;
    return entryId ? entriesById.get(entryId) : undefined;
  };
  const activePlayers = players.filter((p) => !p.is_bye);
  const roundOneMatches = rounds[0]?.[1].length ?? 0;
  const sessionDrawSize = bracketExists ? roundOneMatches * 2 : drawSizeFor(activePlayers.length);
  const drawKind = night?.kind === "qualifier" ? "qualifier" : "knockout";


  return (
    <div className="page page-photo">
      {/* A 2027 session goes back to its competition; older nights to the list */}
      {competitionId ? (
        <Link href={`/admin/competitions/${competitionId}`} className="page-back-link">
          <span aria-hidden="true">&lsaquo;</span>{" "}
          {context ? `${context.competition.series.name} ${context.competition.year}` : "Competition"}
        </Link>
      ) : (
        <Link href="/admin" className="page-back-link">
          <span aria-hidden="true">&lsaquo;</span> All nights
        </Link>
      )}

      <h1>{night?.name ?? "Loading…"}</h1>
      {error && <p className="error">{error}</p>}

      {role === "owner" && night && !isFinals && (!newFlow || bracketExists) && (
        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            borderColor: night.draw_published ? "var(--line)" : "var(--gold)",
          }}
        >
          <div>
            <strong>{night.draw_published ? "Draw is live" : "Draw is hidden"}</strong>
            <p className="hint" style={{ margin: 0 }}>
              {night.draw_published
                ? "The public page shows the current bracket and scores."
                : "The public page only shows the roster — the bracket stays private until you publish it."}
            </p>
          </div>
          <button
            className={night.draw_published ? "secondary" : ""}
            onClick={withErrorHandling(async () => {
              await setDrawPublished(nightId, !night.draw_published);
            })}
          >
            {night.draw_published ? "Unpublish" : "Publish draw"}
          </button>
        </div>
      )}

      {role === "owner" && isFinals && (
        <section>
          <div className="round-heading">
            <h2>Finals lineup</h2>
            <span className="count">
              {finalsSlots.filter(Boolean).length} of {finalsSlots.length} filled
            </span>
          </div>
          <p className="hint">
            Fills in on its own as qualifiers are confirmed on each qualifying night, nothing to add here
            normally. To change someone&rsquo;s number, pick a new one beside their name, or &ldquo;No
            number&rdquo; to take them out.
          </p>
          <FinalsNumberPicker
            slots={finalsSlots}
            pool={orderedPlayers}
            currentSeedOf={(p) => p.seed}
            onAssign={withErrorHandling((player, seed) => setFinalsPlayerSeed(player, seed))}
          />
        </section>
      )}

      {role === "owner" &&
        (isFinals ? (
          <AddExtraFinalsPlayer
            entryAdder={entryAdder}
            onAdd={withErrorHandling((name: string) => addPlayer(nightId, name))}
          />
        ) : (
          !newFlow && (
          <PlayerSection
            players={orderedPlayers}
            bracketExists={bracketExists}
            entryAdder={entryAdder}
            onAdd={withErrorHandling((name: string) => addPlayer(nightId, name))}
            onReorder={withErrorHandling((ids: string[]) => reorderPlayers(ids))}
            onRename={withErrorHandling((id: string, name: string) => renamePlayer(id, name))}
            onToggleBye={withErrorHandling((id: string, isBye: boolean) => setPlayerBye(id, isBye))}
            onRemove={withErrorHandling((id: string) => deletePlayer(id))}
          />
          )
        ))}

      {role === "owner" && !isFinals && !bracketExists && context && activePlayers.length < 2 && (
        <div className="card">
          <h2>Make the draw</h2>
          <p className="hint" style={{ margin: 0 }}>
            {activePlayers.length === 0 ? "Nobody entered yet." : "Only one entered so far."} Enter{" "}
            {context.competition.team_size === 2 ? "pairs" : "players"} on the{" "}
            <Link href={`/admin/competitions/${context.competition.id}`}>competition&rsquo;s page</Link> - they
            appear here straight away.
          </p>
        </div>
      )}

      {role === "owner" && !isFinals && !bracketExists && context && activePlayers.length >= 2 && (
        <DrawMaker
          players={players}
          onRandom={withErrorHandling(async () => {
            const numbers = randomDrawNumbers(activePlayers.map((p) => p.id));
            await setDrawNumbers(new Map(activePlayers.map((p) => [p.id, numbers.get(p.id) ?? null])));
          })}
          onSetNumber={withErrorHandling((player: Player, n: number | null) =>
            setDrawNumbers(new Map([[player.id, n]]))
          )}
          onClear={withErrorHandling(() => setDrawNumbers(new Map(players.map((p) => [p.id, null]))))}
          onRemove={withContextRefresh(async (player: Player) => {
            const entry = context.entries.find((e) => e.id === player.entry_id);
            if (!entry) throw new Error("Couldn't find that entry - remove them on the competition's page.");
            await deleteEntry(entry);
          })}
          onConfirm={withContextRefresh((method: string, publish: boolean) =>
            makeDraw(nightId, drawKind, context.competition.target_score, method, publish)
          )}
        />
      )}

      {role === "owner" && oneDay && context && (
        <TimeSlotsEditor
          slots={context.timeSlots}
          drawSize={sessionDrawSize}
          onSave={async (slots) => {
            await saveTimeSlots(nightId, slots);
            await reloadContext();
          }}
        />
      )}

      {role === "owner" && !isFinals && !bracketExists && !newFlow && (
        <BracketSetup
          players={orderedPlayers}
          onGenerate={withErrorHandling(async () => {
            await generateBracket(nightId, orderedPlayers, drawKind);
          })}
        />
      )}

      {role === "owner" && bracketExists && (
        <div style={{ margin: "20px 0" }}>
          <ResetBracketControl
            nightName={night?.name ?? ""}
            onReset={withErrorHandling(async () => {
              await resetBracket(nightId);
            })}
          />
        </div>
      )}

      {role === "scorer" && bracketExists && !night?.draw_published && (
        <p className="empty">This draw isn&rsquo;t published yet &mdash; nothing to score.</p>
      )}

      {bracketExists && (role === "owner" || night?.draw_published) && (
        <>
          {rounds.map(([round, roundMatches]) => (
            <section key={round}>
              <div className="round-heading">
                <h2>{roundLabel(night?.kind ?? "qualifier", round, roundMatches.length)}</h2>
              </div>
              {roundMatches.map((m) => (
                <MatchEditor
                  key={m.id}
                  match={m}
                  playerNames={playerNames}
                  pending={pendingMatchIds.has(m.id)}
                  resultsOnly={resultsOnly}
                  onAdjust={(side, delta) => handleAdjust(m, side, delta)}
                  onComplete={withErrorHandling(() => completeMatch(m))}
                  onReopen={withErrorHandling(() => reopenMatch(m))}
                  onSaveResult={withErrorHandling((scoreA: number, scoreB: number) => saveResult(m, scoreA, scoreB))}
                  onNoShow={withErrorHandling((side: "a" | "b") => markNoShow(m, side, isFinals))}
                  onUndoNoShow={withErrorHandling(() => undoNoShow(m))}
                  startTime={round === 1 && oneDay && context ? roundOneTime(context.timeSlots, m.slot) : null}
                  onSetTime={
                    round === 1 && oneDay && context && role === "owner"
                      ? withContextRefresh((time: string | null) => setMatchTime(nightId, m.slot, time))
                      : undefined
                  }
                  // Replacing someone changes the entries - admins only
                  entryA={role === "owner" ? entryOf(m.player_a_id) : undefined}
                  entryB={role === "owner" ? entryOf(m.player_b_id) : undefined}
                  pairs={context?.competition.team_size === 2}
                  clubs={context?.clubs ?? []}
                  onReplace={withContextRefresh((side: "a" | "b", personId: string, partnerId: string | null) =>
                    replaceInDraw(m, side, personId, partnerId)
                  )}
                />
              ))}
            </section>
          ))}

          {role === "owner" && night?.kind === "qualifier" && qualifiers.length > 0 && (
            <section>
              <div className="round-heading">
                <h2>Through to Finals Day</h2>
              </div>
              <p className="hint">Pick the number each player drew for finals day.</p>
              <FinalsNumberPicker
                slots={finalsSlots}
                pool={qualifiers}
                currentSeedOf={(p) => p.finals_number}
                occupantIdentity={(p) => p.qualified_from_player_id ?? p.id}
                onAssign={withErrorHandling((player, number) => setFinalsNumber(player, number))}
              />
            </section>
          )}
        </>
      )}

      {role === "owner" && <ViewerLog nightId={nightId} />}
    </div>
  );
}

function PlayerSection({
  players,
  bracketExists,
  entryAdder,
  onAdd,
  onReorder,
  onRename,
  onToggleBye,
  onRemove,
}: {
  players: Player[];
  bracketExists: boolean;
  // A 2027 competition's session: players come from its entries, not typed
  entryAdder?: React.ReactNode;
  onAdd: (name: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onRename: (playerId: string, name: string) => Promise<void>;
  onToggleBye: (playerId: string, isBye: boolean) => Promise<void>;
  onRemove: (playerId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [order, setOrder] = useState<string[]>(() => players.map((p) => p.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const serverIds = players.map((p) => p.id);
    setOrder((current) => {
      const sameSet = current.length === serverIds.length && current.every((id) => serverIds.includes(id));
      return sameSet ? current : serverIds;
    });
  }, [players]);

  const orderedForDisplay = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    return order.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
  }, [order, players]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name.trim());
    setName("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    onReorder(next);
  }

  return (
    <section>
      <h2>Players ({players.length})</h2>
      {!bracketExists && (
        <>
          <p className="hint">
            Add players in any order, then drag them into position for round 1 pairing &mdash; player 1 plays
            player 2, player 3 plays player 4, and so on. Didn&rsquo;t show up on the night? Mark their spot as
            a bye instead of removing them, so everyone else&rsquo;s position stays put.
          </p>
          {entryAdder ?? (
            <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} />
              <button type="submit">Add</button>
            </form>
          )}
        </>
      )}
      {orderedForDisplay.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="card">
              {orderedForDisplay.map((p, i) => (
                <SortablePlayerRow
                  key={p.id}
                  player={p}
                  index={i}
                  draggable={!bracketExists}
                  onRename={(name) => onRename(p.id, name)}
                  onToggleBye={bracketExists ? undefined : () => onToggleBye(p.id, !p.is_bye)}
                  onRemove={bracketExists ? undefined : () => onRemove(p.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function SortablePlayerRow({
  player,
  index,
  draggable,
  onRename,
  onToggleBye,
  onRemove,
}: {
  player: Player;
  index: number;
  draggable: boolean;
  onRename: (name: string) => Promise<void>;
  onToggleBye?: () => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
    disabled: !draggable,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(player.name);

  async function save() {
    const trimmed = draftName.trim();
    setEditing(false);
    if (trimmed && trimmed !== player.name) await onRename(trimmed);
    else setDraftName(player.name);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        {draggable && (
          <span {...attributes} {...listeners} className="drag-handle" aria-label="Drag to reorder">
            &#10021;
          </span>
        )}
        <span style={{ flex: "none" }}>{index + 1}.</span>
        {player.is_bye ? (
          <span className="hint" style={{ margin: 0, fontStyle: "italic" }}>
            BYE <span style={{ opacity: 0.7 }}>(was {player.name})</span>
          </span>
        ) : player.entry_id ? (
          // Names from an entry are changed on the competition's entries
          <PlayerName name={player.name} />
        ) : editing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraftName(player.name);
                setEditing(false);
              }
            }}
            style={{ padding: "2px 6px" }}
          />
        ) : (
          <button
            type="button"
            className="rename-trigger"
            onClick={() => {
              setDraftName(player.name);
              setEditing(true);
            }}
          >
            {player.name}
          </button>
        )}
      </span>
      <span style={{ display: "flex", gap: 8, flex: "none" }}>
        {onToggleBye && (
          <button className="secondary" onClick={onToggleBye}>
            {player.is_bye ? "Undo bye" : "Bye"}
          </button>
        )}
        {onRemove && (
          <button className="secondary" onClick={onRemove}>
            Remove
          </button>
        )}
      </span>
    </div>
  );
}

function AddExtraFinalsPlayer({
  entryAdder,
  onAdd,
}: {
  entryAdder?: React.ReactNode;
  onAdd: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (open && entryAdder) {
    return (
      <section>
        {entryAdder}
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Done
        </button>
      </section>
    );
  }

  if (!open) {
    return (
      <p className="hint">
        Need to add someone who didn&rsquo;t come through a qualifying night?{" "}
        <button className="secondary" style={{ padding: "2px 10px" }} onClick={() => setOpen(true)}>
          Add a player
        </button>
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        await onAdd(name.trim());
        setName("");
        setOpen(false);
      }}
      style={{ display: "flex", gap: 8, marginBottom: 20 }}
    >
      <input
        placeholder="Player name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <button type="submit">Add</button>
      <button type="button" className="secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

function BracketSetup({
  players,
  onGenerate,
}: {
  players: Player[];
  onGenerate: () => Promise<void>;
}) {
  const count = players.length;
  const isPowerOfTwo = count >= 2 && (count & (count - 1)) === 0;
  const canGenerate = count >= 2;

  return (
    <section className="card">
      <h2>Set up the draw</h2>
      <p className="hint">
        Round 1 is built from the list above, paired in the order shown. Doesn&rsquo;t need to be an exact
        power of two (8, 16, 32&hellip;) &mdash; if it isn&rsquo;t, the odd one(s) out get a bye and advance
        automatically.
      </p>
      <button onClick={onGenerate} disabled={!canGenerate}>
        Generate draw
      </button>
      {!canGenerate && <p className="hint">Add at least two players first.</p>}
      {canGenerate && !isPowerOfTwo && (
        <p className="hint">
          {count} players &mdash; {nextPowerOfTwo(count) - count} bye
          {nextPowerOfTwo(count) - count === 1 ? "" : "s"} will fill out round 1.
        </p>
      )}
    </section>
  );
}

function MatchEditor({
  match,
  playerNames,
  pending,
  resultsOnly,
  onAdjust,
  onComplete,
  onReopen,
  onSaveResult,
  onNoShow,
  onUndoNoShow,
  startTime,
  onSetTime,
  entryA,
  entryB,
  pairs,
  clubs,
  onReplace,
}: {
  match: MatchRow;
  playerNames: Record<string, string>;
  pending: boolean;
  resultsOnly: boolean;
  onAdjust: (side: "a" | "b", delta: number) => void;
  onComplete: () => Promise<void>;
  onReopen: () => Promise<void>;
  onSaveResult: (scoreA: number, scoreB: number) => Promise<void>;
  onNoShow: (side: "a" | "b") => Promise<void>;
  onUndoNoShow: () => Promise<void>;
  // First round only: its start time, and changing it by hand
  startTime: string | null;
  onSetTime?: (time: string | null) => Promise<void>;
  // 2027 competitions: who's in the match, for replacing someone
  entryA?: EntryWithPeople;
  entryB?: EntryWithPeople;
  pairs: boolean;
  clubs: Organiser[];
  onReplace: (side: "a" | "b", personId: string, partnerId: string | null) => Promise<void>;
}) {
  const [showHistory, setShowHistory] = useState(false);

  if (!match.player_a_id || !match.player_b_id) {
    const isBye = match.status === "complete" && Boolean(match.player_a_id) !== Boolean(match.player_b_id);
    const advancingId = match.player_a_id ?? match.player_b_id;
    const advancingName = advancingId ? playerNames[advancingId] : null;
    return (
      <div className="card">
        <p className="hint" style={{ margin: 0 }}>
          {isBye
            ? `${advancingName ?? "This player"} gets a bye and advances automatically.`
            : advancingName
            ? `${advancingName} is through — waiting for their opponent.`
            : match.round === 1
            ? "Waiting for this slot's draw number to be given out."
            : "Waiting for the winners of earlier matches."}
        </p>
      </div>
    );
  }

  const complete = match.status === "complete";
  const canComplete = !complete && isMatchComplete(match);
  const nameA = playerNames[match.player_a_id] ?? "—";
  const nameB = playerNames[match.player_b_id] ?? "—";

  // Didn't turn up: both names stay, the absent one struck through
  if (isWalkover(match)) {
    const absentA = match.winner_id === match.player_b_id;
    return (
      <div className="card walkover">
        <p style={{ margin: 0 }}>
          <span className="walkover-absent">{absentA ? nameA : nameB}</span> didn&rsquo;t turn up &mdash;{" "}
          <strong>{absentA ? nameB : nameA}</strong> through.
        </p>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            if (confirm(`${absentA ? nameA : nameB} has turned up - put this match back on?`)) onUndoNoShow();
          }}
        >
          They&rsquo;ve turned up - undo
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {(startTime || onSetTime) && match.status === "upcoming" && (
        <MatchTime time={startTime} onSetTime={onSetTime} />
      )}
      {resultsOnly ? (
        <ResultEntry
          nameA={nameA}
          nameB={nameB}
          scoreA={match.score_a}
          scoreB={match.score_b}
          targetScore={match.target_score}
          status={match.status}
          pending={pending}
          onSave={onSaveResult}
        />
      ) : (
        <div className={`match ${complete ? "complete" : ""}`}>
          <div className="players">
            <ScoreLine
              name={nameA}
              score={match.score_a}
              targetScore={match.target_score}
              isWinner={Boolean(match.winner_id) && match.winner_id === match.player_a_id}
              disabled={complete || pending}
              onAdjust={(delta) => onAdjust("a", delta)}
            />
            <hr className="divider" />
            <ScoreLine
              name={nameB}
              score={match.score_b}
              targetScore={match.target_score}
              isWinner={Boolean(match.winner_id) && match.winner_id === match.player_b_id}
              disabled={complete || pending}
              onAdjust={(delta) => onAdjust("b", delta)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
            {match.status === "live" ? (
              <span className="live-flag">
                <span className="live-dot" />
                Live
              </span>
            ) : (
              <span className={`status-pill ${match.status}`}>{match.status}</span>
            )}
            {!complete && (
              <button onClick={onComplete} disabled={!canComplete}>
                Mark complete
              </button>
            )}
            {complete && (
              <button
                className="secondary"
                onClick={() => {
                  if (confirm("Reopen this match to fix a mistake?")) onReopen();
                }}
              >
                Reopen
              </button>
            )}
          </div>
        </div>
      )}
      {!complete && (
        <ChangePeopleControl
          nameA={nameA}
          nameB={nameB}
          entryA={entryA}
          entryB={entryB}
          pairs={pairs}
          clubs={clubs}
          canNoShow={match.status === "upcoming" && match.round === 1}
          onNoShow={onNoShow}
          onReplace={onReplace}
        />
      )}
      {!resultsOnly && match.status !== "upcoming" && (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="link-button match-history-toggle" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Hide history" : "History"}
          </button>
          {showHistory && <MatchHistory matchId={match.id} admin nameA={nameA} nameB={nameB} />}
        </div>
      )}
    </div>
  );
}

function ResetBracketControl({ nightName, onReset }: { nightName: string; onReset: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText.trim().length > 0 && confirmText.trim() === nightName;

  if (!open) {
    return (
      <button className="secondary" onClick={() => setOpen(true)}>
        Reset bracket
      </button>
    );
  }

  return (
    <div className="card" style={{ borderColor: "var(--maroon)" }}>
      <p className="error" style={{ marginTop: 0 }}>
        This deletes every match and score for this night. There&rsquo;s no way to undo it.
      </p>
      <p className="hint">
        Type the night&rsquo;s name to confirm: <strong>{nightName}</strong>
      </p>
      <div className="field">
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={nightName}
          autoFocus
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="danger"
          disabled={!canConfirm}
          onClick={async () => {
            await onReset();
            setOpen(false);
            setConfirmText("");
          }}
        >
          Delete everything
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setOpen(false);
            setConfirmText("");
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// A first-round match's start time, with a way to change just this match's
function MatchTime({
  time,
  onSetTime,
}: {
  time: string | null;
  onSetTime?: (time: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(time ?? "");

  if (editing && onSetTime) {
    return (
      <div className="match-time match-time-editing">
        <input type="time" aria-label="Start time for this match" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            await onSetTime(draft || null);
            setEditing(false);
          }}
        >
          Save
        </button>
        <button type="button" className="link-button" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="match-time">
      <span>{time ? `Starts ${time}` : "No start time"}</span>
      {onSetTime && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setDraft(time ?? "");
            setEditing(true);
          }}
        >
          Change
        </button>
      )}
    </div>
  );
}

function ScoreLine({
  name,
  score,
  targetScore,
  isWinner,
  disabled,
  onAdjust,
}: {
  name: string;
  score: number;
  targetScore: number;
  isWinner: boolean;
  disabled: boolean;
  onAdjust: (delta: number) => void;
}) {
  const atTarget = score >= targetScore;
  return (
    <div className={`player-row score-line ${isWinner ? "winner" : ""}`}>
      <span className="name-cell">
        <Avatar name={name} />
        <PlayerName name={name} />
      </span>
      <div className="score-stepper">
        <button className="secondary" disabled={disabled} onClick={() => onAdjust(-1)}>
          &minus;
        </button>
        <FlashingScore value={score} className="value" />
        <button className="secondary" disabled={disabled || atTarget} onClick={() => onAdjust(1)}>
          +1
        </button>
        <button className="secondary" disabled={disabled || atTarget} onClick={() => onAdjust(2)}>
          +2
        </button>
      </div>
    </div>
  );
}

function ResultEntry({
  nameA,
  nameB,
  scoreA,
  scoreB,
  targetScore,
  status,
  pending,
  onSave,
}: {
  nameA: string;
  nameB: string;
  scoreA: number;
  scoreB: number;
  targetScore: number;
  status: MatchRow["status"];
  pending: boolean;
  onSave: (scoreA: number, scoreB: number) => Promise<void>;
}) {
  const [a, setA] = useState(String(scoreA));
  const [b, setB] = useState(String(scoreB));

  useEffect(() => {
    setA(String(scoreA));
    setB(String(scoreB));
  }, [scoreA, scoreB]);

  const complete = status === "complete";
  const numA = Number(a);
  const numB = Number(b);
  const validA = a.trim() !== "" && Number.isInteger(numA) && numA >= 0 && numA <= targetScore;
  const validB = b.trim() !== "" && Number.isInteger(numB) && numB >= 0 && numB <= targetScore;
  const wouldBeComplete = validA && validB && (numA >= targetScore || numB >= targetScore);
  const levelWhenComplete = wouldBeComplete && numA === numB;
  const canSave = validA && validB && !levelWhenComplete;

  return (
    <div>
      <div className="players">
        <div className="player-row">
          <PlayerName name={nameA} />
          <input
            className="result-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={targetScore}
            value={a}
            onChange={(e) => setA(e.target.value)}
          />
        </div>
        <hr className="divider" />
        <div className="player-row">
          <PlayerName name={nameB} />
          <input
            className="result-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={targetScore}
            value={b}
            onChange={(e) => setB(e.target.value)}
          />
        </div>
      </div>
      {levelWhenComplete && (
        <p className="error" style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>
          Scores can&rsquo;t be level once someone&rsquo;s reached {targetScore} &mdash; there has to be a winner.
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        {status === "live" ? (
          <span className="live-flag">
            <span className="live-dot" />
            Live
          </span>
        ) : (
          <span className={`status-pill ${status}`}>{status === "upcoming" ? "result pending" : status}</span>
        )}
        <button disabled={!canSave || pending} onClick={() => onSave(numA, numB)}>
          {complete ? "Update result" : "Save result"}
        </button>
      </div>
    </div>
  );
}

