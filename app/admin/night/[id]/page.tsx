"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  addPlayer,
  adjustScore,
  completeMatch,
  deletePlayer,
  generateBracket,
  getFinalsRoster,
  resetBracket,
  setFinalsNumber,
  setFinalsPlayerSeed,
} from "@/lib/adminActions";
import { buildFinalsSlots, FINALS_DRAW_SIZE, isMatchComplete, roundLabel } from "@/lib/bracket";
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
      supabase.from("players").select("*").eq("night_id", nightId).order("created_at"),
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

  // On a qualifying night, players are paired in the order they were added.
  // On finals day, players arrive from different qualifying nights at
  // different times, so their draw position is their seed (the number they
  // drew), not when they happened to be added here.
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

  // Which finals-day slot each occupant holds, for labelling the picker -
  // sourced from finals day's own player list when we're on finals day
  // itself, or the separately-fetched roster when we're on a qualifying
  // night looking ahead at finals day.
  const finalsOccupancy = isFinals ? players : finalsRoster;
  const finalsSlots = useMemo(() => buildFinalsSlots(orderedPlayers), [orderedPlayers]);
  const bracketExists = matches.length > 0;

  return (
    <div className="page">
      <div className="top-bar">
        <Link href="/admin" className="brand">
          &larr; All nights
        </Link>
      </div>

      <h1>{night?.name ?? "Loading\u2026"}</h1>
      {error && <p className="error">{error}</p>}

      {isFinals && !bracketExists && (
        <FinalsLineup
          slots={finalsSlots}
          occupancy={finalsOccupancy}
          onMove={withErrorHandling((player, seed) => setFinalsPlayerSeed(player, seed))}
        />
      )}

      {isFinals && !bracketExists && (
        <UnplacedSection
          players={orderedPlayers.filter((p) => p.seed == null)}
          occupancy={finalsOccupancy}
          onMove={withErrorHandling((player, seed) => setFinalsPlayerSeed(player, seed))}
        />
      )}

      {isFinals ? (
        !bracketExists && (
          <AddExtraFinalsPlayer
            nightId={nightId}
            onAdded={withErrorHandling(async () => {})}
          />
        )
      ) : (
        <PlayerSection
          nightId={nightId}
          players={orderedPlayers}
          bracketExists={bracketExists}
          onChange={withErrorHandling(async () => {})}
        />
      )}

      {!bracketExists ? (
        <BracketSetup
          players={orderedPlayers}
          nightKind={night?.kind ?? "qualifier"}
          onGenerate={withErrorHandling(async () => {
            await generateBracket(nightId, orderedPlayers, night?.kind ?? "qualifier");
          })}
        />
      ) : (
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

          {night?.kind === "qualifier" && (
            <QualifiersSection
              qualifiers={qualifiers}
              occupancy={finalsOccupancy}
              onSave={withErrorHandling((player, number) => setFinalsNumber(player, number))}
            />
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
  onChange,
}: {
  nightId: string;
  players: Player[];
  bracketExists: boolean;
  onChange: () => Promise<void>;
}) {
  const [name, setName] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await addPlayer(nightId, name.trim());
    setName("");
    await onChange();
  }

  return (
    <section>
      <h2>Players ({players.length})</h2>
      {!bracketExists && (
        <>
          <p className="hint">
            Add players in the order you want them paired for round 1 &mdash; player 1 plays player 2, player 3
            plays player 4, and so on.
          </p>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit">Add</button>
          </form>
        </>
      )}
      {players.length > 0 && (
        <div className="card">
          {players.map((p, i) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>
                {i + 1}. {p.name}
              </span>
              {!bracketExists && (
                <button
                  className="secondary"
                  onClick={async () => {
                    await deletePlayer(p.id);
                    await onChange();
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
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

/**
 * The full 16-slot finals-day lineup, filled in as far as numbers have been
 * assigned. Click a filled slot's name to move them somewhere else - handy
 * for correcting a mistake without resetting anything.
 */
function FinalsLineup({
  slots,
  occupancy,
  onMove,
}: {
  slots: Array<Player | null>;
  occupancy: Player[];
  onMove: (player: Player, seed: number | null) => Promise<void>;
}) {
  const filledCount = slots.filter(Boolean).length;

  return (
    <section>
      <div className="round-heading">
        <h2>Finals lineup</h2>
        <span className="count">{filledCount} of {slots.length} filled</span>
      </div>
      <p className="hint">
        Fills in on its own as qualifiers are confirmed on each qualifying night &mdash; nothing to add here
        normally. Click a name to move them to a different number if needed.
      </p>
      <div className="card">
        {slots.map((player, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "4px 0", minHeight: 32 }}>
            <span style={{ width: 28, color: "var(--ink-soft)" }}>{i + 1}.</span>
            {player ? (
              <SlotPickerTrigger
                label={player.name}
                currentSeed={player.seed}
                occupancy={occupancy}
                showSeedBadge={false}
                onChoose={(seed) => onMove(player, seed)}
              />
            ) : (
              <span>&nbsp;</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Players who exist on finals day but don't have a number yet - either just
 * arrived from a qualifying night mid-save, or added manually here.
 */
function UnplacedSection({
  players,
  occupancy,
  onMove,
}: {
  players: Player[];
  occupancy: Player[];
  onMove: (player: Player, seed: number | null) => Promise<void>;
}) {
  if (players.length === 0) return null;
  return (
    <section>
      <h2>Not yet placed</h2>
      <div className="card">
        {players.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "4px 0" }}>
            <SlotPickerTrigger
              label={p.name}
              currentSeed={p.seed}
              occupancy={occupancy}
              onChoose={(seed) => onMove(p, seed)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function BracketSetup({
  players,
  nightKind,
  onGenerate,
}: {
  players: Player[];
  nightKind: "qualifier" | "finals";
  onGenerate: () => Promise<void>;
}) {
  const count = players.length;
  const unplacedCount = nightKind === "finals" ? players.filter((p) => p.seed == null).length : 0;
  const isPowerOfTwo = count >= 2 && (count & (count - 1)) === 0;
  const canGenerate = isPowerOfTwo && unplacedCount === 0;

  return (
    <section className="card">
      <h2>Set up the draw</h2>
      <p className="hint">
        {nightKind === "finals"
          ? "Round 1 pairs number 1 v 2, 3 v 4, and so on. Every slot needs a number before you can generate it."
          : "Round 1 is built from the player list above, paired in the order shown. Add all the players first (a power of two \u2014 8, 16, 32\u2026), then generate the draw."}
      </p>
      <button onClick={onGenerate} disabled={!canGenerate}>
        Generate draw
      </button>
      {!isPowerOfTwo && (
        <p className="hint">
          {count < 2 ? "Add at least two players first." : `${count} isn't a power of two \u2014 add or remove a player.`}
        </p>
      )}
      {isPowerOfTwo && unplacedCount > 0 && (
        <p className="hint">
          {unplacedCount} player{unplacedCount === 1 ? "" : "s"} {unplacedCount === 1 ? "doesn't" : "don't"} have a
          number yet &mdash; assign {unplacedCount === 1 ? "them" : "them all"} above first.
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
          Waiting for the winners of earlier matches.
        </p>
      </div>
    );
  }

  const complete = match.status === "complete";
  const canComplete = !complete && isMatchComplete(match);

  return (
    <div className="card">
      <ScoreLine
        name={playerNames[match.player_a_id] ?? "\u2014"}
        score={match.score_a}
        isWinner={match.winner_id === match.player_a_id}
        disabled={complete}
        onAdjust={(delta) => onAdjust("a", delta)}
      />
      <hr className="divider" />
      <ScoreLine
        name={playerNames[match.player_b_id] ?? "\u2014"}
        score={match.score_b}
        isWinner={match.winner_id === match.player_b_id}
        disabled={complete}
        onAdjust={(delta) => onAdjust("b", delta)}
      />
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className={`status-pill ${match.status}`}>{match.status}</span>
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

function QualifiersSection({
  qualifiers,
  occupancy,
  onSave,
}: {
  qualifiers: Player[];
  occupancy: Player[];
  onSave: (player: Player, finalsNumber: number | null) => Promise<void>;
}) {
  if (qualifiers.length === 0) return null;

  return (
    <section>
      <div className="round-heading">
        <h2>Advancing to finals day</h2>
      </div>
      <p className="hint">Tap a name to choose their finals-day number. Tap again any time to move them.</p>
      <div className="card">
        {qualifiers.map((p) => (
          <div key={p.id} style={{ padding: "6px 0" }}>
            <SlotPickerTrigger
              label={p.name}
              currentSeed={p.finals_number}
              occupancy={occupancy}
              onChoose={(seed) => onSave(p, seed)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Shared control: shows a name (with its finals number, if any) as a
 * clickable label. Clicking opens a dropdown of every finals-day slot,
 * showing who else is in each one, so you can place - or move - this
 * person with one choice.
 */
function SlotPickerTrigger({
  label,
  currentSeed,
  occupancy,
  showSeedBadge = true,
  onChoose,
}: {
  label: string;
  currentSeed: number | null;
  occupancy: Player[];
  showSeedBadge?: boolean;
  onChoose: (seed: number | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const occupantAt = (seed: number) => occupancy.find((p) => p.seed === seed && p.name !== label);

  if (!open) {
    return (
      <button
        type="button"
        className="player-row"
        style={{
          border: "none",
          background: "none",
          width: "100%",
          padding: "2px 0",
          cursor: "pointer",
          font: "inherit",
          color: "var(--ink)",
        }}
        onClick={() => setOpen(true)}
      >
        <span className="name">{label}</span>
        {showSeedBadge &&
          (currentSeed != null ? (
            <span className="score">{currentSeed}</span>
          ) : (
            <span className="hint" style={{ margin: 0 }}>
              Choose number
            </span>
          ))}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span>{label}</span>
      <select
        defaultValue={currentSeed ?? ""}
        onChange={async (e) => {
          const value = e.target.value;
          const seed = value === "" ? null : Number(value);
          if (seed != null) {
            const occupant = occupantAt(seed);
            if (occupant && !confirm(`${occupant.name} is currently #${seed}. Move ${label} there instead?`)) {
              return;
            }
          }
          setOpen(false);
          await onChoose(seed);
        }}
      >
        <option value="">Choose a number&hellip;</option>
        {Array.from({ length: FINALS_DRAW_SIZE }, (_, i) => i + 1).map((n) => {
          const occupant = occupantAt(n);
          return (
            <option key={n} value={n}>
              {n}
              {occupant ? ` \u2014 ${occupant.name}` : ""}
            </option>
          );
        })}
      </select>
      <button className="secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
