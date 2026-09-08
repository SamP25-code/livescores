"use client";

import { useEffect, useMemo, useState } from "react";
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
  addPlayer,
  adjustScore,
  completeMatch,
  deletePlayer,
  generateBracket,
  getFinalsRoster,
  reorderPlayers,
  resetBracket,
  setFinalsNumber,
  setFinalsPlayerSeed,
} from "@/lib/adminActions";
import { buildFinalsSlots, isMatchComplete, roundLabel } from "@/lib/bracket";
import FinalsSlotBoard from "@/components/FinalsSlotBoard";
import type { MatchRow, Night, Player } from "@/lib/types";

export default function AdminNightPage({ params }: { params: { id: string } }) {
  const nightId = params.id;
  const [night, setNight] = useState<Night | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [finalsRoster, setFinalsRoster] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [{ data: nightData }, { data: playerData }, { data: matchData }, roster] = await Promise.all([
      supabase.from("nights").select("*").eq("id", nightId).single(),
      supabase.from("players").select("*").eq("night_id", nightId).order("sort_order"),
      supabase.from("matches").select("*").eq("night_id", nightId).order("round").order("slot"),
      getFinalsRoster(),
    ]);
    setNight(nightData ?? null);
    setPlayers(playerData ?? []);
    setMatches(matchData ?? []);
    setFinalsRoster(roster?.players ?? []);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightId]);

  function withErrorHandling<Args extends unknown[]>(fn: (...args: Args) => Promise<void>) {
    return async (...args: Args) => {
      setError(null);
      try {
        await fn(...args);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    };
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

  // On a qualifying night, players are paired in round-1 draw order (drag to
  // set it - see PlayerSection). On finals day, players arrive from
  // different qualifying nights at different times, so their draw position
  // is their seed (the number they drew), not when they happened to be
  // added here.
  const orderedPlayers = useMemo(() => {
    if (!isFinals) return players;
    return [...players].sort((a, b) => {
      if (a.seed == null) return 1;
      if (b.seed == null) return -1;
      return a.seed - b.seed;
    });
  }, [players, isFinals]);

  const playerNames = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name])), [players]);

  // Winners of the final round of a qualifying night: these are the players
  // advancing to finals day, in the order they finished their match.
  const qualifiers = useMemo(() => {
    if (!night || night.kind !== "qualifier" || lastRound === 0) return [];
    return matches
      .filter((m) => m.round === lastRound && m.status === "complete" && m.winner_id)
      .sort((a, b) => a.slot - b.slot)
      .map((m) => players.find((p) => p.id === m.winner_id))
      .filter((p): p is Player => Boolean(p));
  }, [matches, players, night, lastRound]);

  // Which finals-day slot each occupant holds - sourced from finals day's
  // own player list when we're on finals day itself, or the
  // separately-fetched roster when we're on a qualifying night looking
  // ahead at finals day.
  const finalsOccupancy = isFinals ? players : finalsRoster;
  const finalsSlots = useMemo(() => buildFinalsSlots(finalsOccupancy), [finalsOccupancy]);
  const bracketExists = matches.length > 0;

  return (
    <div className="page">
      <div className="top-bar">
        <Link href="/admin" className="brand">
          &larr; All nights
        </Link>
      </div>

      <h1>{night?.name ?? "Loading…"}</h1>
      {error && <p className="error">{error}</p>}

      {isFinals && (
        <section>
          <div className="round-heading">
            <h2>Finals lineup</h2>
            <span className="count">
              {finalsSlots.filter(Boolean).length} of {finalsSlots.length} filled
            </span>
          </div>
          <p className="hint">
            Fills in on its own as qualifiers are confirmed on each qualifying night &mdash; nothing to add here
            normally. Drag a name onto a number to place them, or back down to &ldquo;Not yet placed&rdquo; to
            clear it.
          </p>
          <FinalsSlotBoard
            slots={finalsSlots}
            pool={orderedPlayers}
            currentSeedOf={(p) => p.seed}
            onAssign={withErrorHandling((player, seed) => setFinalsPlayerSeed(player, seed))}
          />
        </section>
      )}

      {isFinals ? (
        <AddExtraFinalsPlayer nightId={nightId} onAdded={withErrorHandling(async () => {})} />
      ) : (
        <PlayerSection
          nightId={nightId}
          players={orderedPlayers}
          bracketExists={bracketExists}
          onReorder={withErrorHandling((ids: string[]) => reorderPlayers(ids))}
          onChange={withErrorHandling(async () => {})}
        />
      )}

      {!isFinals && !bracketExists && (
        <BracketSetup
          players={orderedPlayers}
          onGenerate={withErrorHandling(async () => {
            await generateBracket(nightId, orderedPlayers, "qualifier");
          })}
        />
      )}

      {bracketExists && (
        <>
          <div style={{ margin: "20px 0" }}>
            <button
              className="secondary"
              onClick={withErrorHandling(async () => {
                if (confirm("Delete the whole bracket for this night? Scores will be lost.")) {
                  await resetBracket(nightId);
                }
              })}
            >
              Reset bracket
            </button>
          </div>

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
                  onAdjust={withErrorHandling((side, delta) => adjustScore(m, side, delta))}
                  onComplete={withErrorHandling(() => completeMatch(m))}
                />
              ))}
            </section>
          ))}

          {night?.kind === "qualifier" && qualifiers.length > 0 && (
            <section>
              <div className="round-heading">
                <h2>Advancing to finals day</h2>
              </div>
              <p className="hint">Drag a name onto the number they drew for finals day.</p>
              <FinalsSlotBoard
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
    </div>
  );
}

function PlayerSection({
  nightId,
  players,
  bracketExists,
  onReorder,
  onChange,
}: {
  nightId: string;
  players: Player[];
  bracketExists: boolean;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onChange: () => Promise<void>;
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
    await addPlayer(nightId, name.trim());
    setName("");
    await onChange();
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
            player 2, player 3 plays player 4, and so on.
          </p>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit">Add</button>
          </form>
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
                  onRemove={
                    bracketExists
                      ? undefined
                      : async () => {
                          await deletePlayer(p.id);
                          await onChange();
                        }
                  }
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
  onRemove,
}: {
  player: Player;
  index: number;
  draggable: boolean;
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

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {draggable && (
          <span {...attributes} {...listeners} className="drag-handle" aria-label="Drag to reorder">
            &#10021;
          </span>
        )}
        {index + 1}. {player.name}
      </span>
      {onRemove && (
        <button className="secondary" onClick={onRemove}>
          Remove
        </button>
      )}
    </div>
  );
}

/**
 * Finals day fills in automatically as qualifiers are confirmed, so there's
 * nothing to add in the normal case. This is only for the rare exception -
 * a replacement, a bye - and deliberately stays out of the way so it isn't
 * mistaken for a required step.
 */
function AddExtraFinalsPlayer({ nightId, onAdded }: { nightId: string; onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

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
        await addPlayer(nightId, name.trim());
        setName("");
        setOpen(false);
        await onAdded();
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

  return (
    <section className="card">
      <h2>Set up the draw</h2>
      <p className="hint">
        Round 1 is built from the player list above, paired in the order shown. Add all the players first (a power
        of two &mdash; 8, 16, 32&hellip;), then generate the draw.
      </p>
      <button onClick={onGenerate} disabled={!isPowerOfTwo}>
        Generate draw
      </button>
      {!isPowerOfTwo && (
        <p className="hint">
          {count < 2 ? "Add at least two players first." : `${count} isn't a power of two — add or remove a player.`}
        </p>
      )}
    </section>
  );
}

function MatchEditor({
  match,
  playerNames,
  onAdjust,
  onComplete,
}: {
  match: MatchRow;
  playerNames: Record<string, string>;
  onAdjust: (side: "a" | "b", delta: number) => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  if (!match.player_a_id || !match.player_b_id) {
    return (
      <div className="card">
        <p className="hint" style={{ margin: 0 }}>
          {match.round === 1
            ? "Waiting for this slot's draw number to be given out."
            : "Waiting for the winners of earlier matches."}
        </p>
      </div>
    );
  }

  const complete = match.status === "complete";
  const canComplete = !complete && isMatchComplete(match);

  return (
    <div className={`card match ${complete ? "complete" : ""}`}>
      <div className="players">
        <ScoreLine
          name={playerNames[match.player_a_id] ?? "—"}
          score={match.score_a}
          isWinner={Boolean(match.winner_id) && match.winner_id === match.player_a_id}
          disabled={complete}
          onAdjust={(delta) => onAdjust("a", delta)}
        />
        <hr className="divider" />
        <ScoreLine
          name={playerNames[match.player_b_id] ?? "—"}
          score={match.score_b}
          isWinner={Boolean(match.winner_id) && match.winner_id === match.player_b_id}
          disabled={complete}
          onAdjust={(delta) => onAdjust("b", delta)}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <span className={`status-pill ${match.status}`}>
          {match.status === "live" && <span className="live-dot" />}
          {match.status}
        </span>
        {!complete && (
          <button onClick={onComplete} disabled={!canComplete}>
            Mark complete
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreLine({
  name,
  score,
  isWinner,
  disabled,
  onAdjust,
}: {
  name: string;
  score: number;
  isWinner: boolean;
  disabled: boolean;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div className={`player-row ${isWinner ? "winner" : ""}`}>
      <span className="name">{name}</span>
      <div className="score-stepper">
        <button className="secondary" disabled={disabled} onClick={() => onAdjust(-1)}>
          &minus;
        </button>
        <span className="value">{score}</span>
        <button className="secondary" disabled={disabled} onClick={() => onAdjust(1)}>
          +
        </button>
      </div>
    </div>
  );
}
