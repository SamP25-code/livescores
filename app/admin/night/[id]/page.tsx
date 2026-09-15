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
  ensureFinalsBracketGenerated,
  generateBracket,
  getFinalsRoster,
  markNoShow,
  renamePlayer,
  reopenMatch,
  reorderPlayers,
  resetBracket,
  setFinalsNumber,
  setFinalsPlayerSeed,
  setPlayerBye,
} from "@/lib/adminActions";
import { buildFinalsSlots, isMatchComplete, nextPowerOfTwo, roundLabel } from "@/lib/bracket";
import { errorMessage } from "@/lib/errors";
import FinalsSlotBoard from "@/components/FinalsSlotBoard";
import FlashingScore from "@/components/FlashingScore";
import type { MatchRow, Night, Player } from "@/lib/types";

export default function AdminNightPage({ params }: { params: { id: string } }) {
  const nightId = params.id;
  const [night, setNight] = useState<Night | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [finalsRoster, setFinalsRoster] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = night ? `${night.name} — Admin — Bowls Live` : "Admin — Bowls Live";
  }, [night]);

  async function refresh() {
    const [{ data: nightData }, { data: playerData }, { data: matchData }, roster] = await Promise.all([
      supabase.from("nights").select("*").eq("id", nightId).single(),
      supabase.from("players").select("*").eq("night_id", nightId).order("sort_order").order("created_at"),
      supabase.from("matches").select("*").eq("night_id", nightId).order("round").order("slot"),
      getFinalsRoster(),
    ]);
    setNight(nightData ?? null);
    setPlayers(playerData ?? []);
    setFinalsRoster(roster?.players ?? []);

    // A finals night created before its bracket generated up front (see
    // createNight) won't have one yet - backfill it once, here, rather than
    // making every visitor wait on a manual step.
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
      } catch {
        // Someone else generated it in the meantime - fall through to what we already fetched.
      }
    }

    setMatches(matchData ?? []);
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
        setError(errorMessage(err));
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
      <div className="top-bar top-bar-plain">
        <Link href="/admin" className="back-link">
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
        <AddExtraFinalsPlayer onAdd={withErrorHandling((name: string) => addPlayer(nightId, name))} />
      ) : (
        <PlayerSection
          players={orderedPlayers}
          bracketExists={bracketExists}
          onAdd={withErrorHandling((name: string) => addPlayer(nightId, name))}
          onReorder={withErrorHandling((ids: string[]) => reorderPlayers(ids))}
          onRename={withErrorHandling((id: string, name: string) => renamePlayer(id, name))}
          onToggleBye={withErrorHandling((id: string, isBye: boolean) => setPlayerBye(id, isBye))}
          onRemove={withErrorHandling((id: string) => deletePlayer(id))}
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
            <ResetBracketControl
              nightName={night?.name ?? ""}
              onReset={withErrorHandling(async () => {
                await resetBracket(nightId);
              })}
            />
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
                  onReopen={withErrorHandling(() => reopenMatch(m))}
                  onNoShow={withErrorHandling((side: "a" | "b") => markNoShow(m, side))}
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
  players,
  bracketExists,
  onAdd,
  onReorder,
  onRename,
  onToggleBye,
  onRemove,
}: {
  players: Player[];
  bracketExists: boolean;
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

/**
 * Finals day fills in automatically as qualifiers are confirmed, so there's
 * nothing to add in the normal case. This is only for the rare exception -
 * a replacement, a bye - and deliberately stays out of the way so it isn't
 * mistaken for a required step.
 */
function AddExtraFinalsPlayer({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
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
        Round 1 is built from the player list above, paired in the order shown. Doesn&rsquo;t need to be an exact
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
  onAdjust,
  onComplete,
  onReopen,
  onNoShow,
}: {
  match: MatchRow;
  playerNames: Record<string, string>;
  onAdjust: (side: "a" | "b", delta: number) => Promise<void>;
  onComplete: () => Promise<void>;
  onReopen: () => Promise<void>;
  onNoShow: (side: "a" | "b") => Promise<void>;
}) {
  if (!match.player_a_id || !match.player_b_id) {
    // A bye can land on either side - see markNoShow - so this checks for
    // exactly one blank side on an otherwise-decided match, not specifically
    // which one, and looks up whichever id is actually present.
    const isBye = match.status === "complete" && Boolean(match.player_a_id) !== Boolean(match.player_b_id);
    const advancingId = match.player_a_id ?? match.player_b_id;
    return (
      <div className="card">
        <p className="hint" style={{ margin: 0 }}>
          {isBye
            ? `${(advancingId && playerNames[advancingId]) ?? "This player"} gets a bye and advances automatically.`
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

  return (
    <div className="card">
      <div className={`match ${complete ? "complete" : ""}`}>
        <div className="players">
          <ScoreLine
            name={nameA}
            score={match.score_a}
            isWinner={Boolean(match.winner_id) && match.winner_id === match.player_a_id}
            disabled={complete}
            onAdjust={(delta) => onAdjust("a", delta)}
          />
          <hr className="divider" />
          <ScoreLine
            name={nameB}
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
      {/* Only round 1 - the first round of a qualifying night, or the last 16
          on finals day. Anyone in a later round has already won a match, so
          a no-show there is a different, much rarer situation than not
          turning up at the start of the night. */}
      {!complete && match.round === 1 && <NoShowControl nameA={nameA} nameB={nameB} onNoShow={onNoShow} />}
    </div>
  );
}

/**
 * The one remaining fully destructive action on this page - unlike a bye,
 * a rename, or a reopened match, there's no undo for wiping a night's
 * scores. A plain confirm() is too easy to click through without reading,
 * so this requires typing the night's name back before it'll do anything.
 */
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

/**
 * Handles the far more common bye scenario - someone who was supposed to
 * play doesn't turn up once the draw's already made, sometimes mid-game.
 * Collapsed by default so it doesn't clutter the normal scoring flow.
 */
function NoShowControl({
  nameA,
  nameB,
  onNoShow,
}: {
  nameA: string;
  nameB: string;
  onNoShow: (side: "a" | "b") => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <p style={{ marginTop: 8 }}>
        <button type="button" className="link-button" onClick={() => setOpen(true)}>
          Someone not here?
        </button>
      </p>
    );
  }

  function confirmNoShow(side: "a" | "b", absentName: string, advancingName: string) {
    if (confirm(`${absentName} didn't show - give ${advancingName} the win as a bye?`)) onNoShow(side);
  }

  return (
    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button className="secondary" onClick={() => confirmNoShow("a", nameA, nameB)}>
        {nameA} didn&rsquo;t show
      </button>
      <button className="secondary" onClick={() => confirmNoShow("b", nameB, nameA)}>
        {nameB} didn&rsquo;t show
      </button>
      <button className="secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
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
        <FlashingScore value={score} className="value" />
        <button className="secondary" disabled={disabled} onClick={() => onAdjust(1)}>
          +
        </button>
      </div>
    </div>
  );
}
