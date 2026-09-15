"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { roundLabel } from "@/lib/bracket";
import MatchCard from "@/components/MatchCard";
import type { MatchRow, Night, Player } from "@/lib/types";

// The small, snug gap between the two matches of a round-1 pair, and the
// bigger gap between different pairs - purely an aesthetic starting point.
// Every later round's gap is derived from these, not hand-picked, so that
// each match lands exactly on the midpoint of the two feeding it (see the
// layout effect below).
const ROUND_ONE_PAIR_GAP = 10;
const ROUND_ONE_GROUP_GAP = 16;

type RoundGap = { pairGap: number; groupGap: number };

/**
 * The whole knockout drawn as a tree instead of stacked round lists - only
 * really earns its place on finals day, where the shape of the draw is the
 * point. Scrolls sideways (four-plus rounds never fit a phone width) with
 * tabs to jump straight to a round, and reuses MatchCard as-is so every
 * visual state (bold winner, faded loser, live pill, TBC, BYE, and
 * click-a-name-to-highlight-their-run) is identical to the list view.
 */
export default function BracketTree({
  rounds,
  night,
  players,
  highlightPlayerId,
  onSelectPlayer,
  champion,
}: {
  rounds: Array<[number, MatchRow[]]>;
  night: Night;
  players: Record<string, Player>;
  highlightPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  champion: Player | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bracketRef = useRef<HTMLDivElement>(null);
  const [roundGaps, setRoundGaps] = useState<RoundGap[] | null>(null);

  // Flexbox alone can't center a match on the midpoint of the two matches
  // feeding it beyond the first round - `justify-content: space-around`
  // just divides the column into equal slices, and the error compounds
  // every round until a semi-final/final is visibly too low. The fix that
  // actually works: since round 1's pair pitch is 2H + pairGap + groupGap
  // (H = match height), a round's matches are the *average* of the pair
  // they come from, so the next round's pitch is exactly double the
  // previous one's. Measuring one real match's rendered height and
  // recursing that doubling gives each round the exact gap that makes
  // `justify-content: center` land every match on the right midpoint,
  // without hand-tuning any numbers per round count.
  useLayoutEffect(() => {
    function recompute() {
      const bracketEl = bracketRef.current;
      const sample = bracketEl?.querySelector<HTMLElement>(".match.compact");
      if (!sample) return;
      const matchHeight = sample.getBoundingClientRect().height;
      if (matchHeight <= 0) return;

      const gaps: RoundGap[] = [{ pairGap: ROUND_ONE_PAIR_GAP, groupGap: ROUND_ONE_GROUP_GAP }];
      let pairPitch = 2 * matchHeight + ROUND_ONE_PAIR_GAP + ROUND_ONE_GROUP_GAP;
      for (let r = 1; r < rounds.length; r++) {
        const gap = Math.max(pairPitch - matchHeight, 8);
        gaps.push({ pairGap: gap, groupGap: gap });
        pairPitch = 2 * matchHeight + 2 * gap;
      }
      setRoundGaps(gaps);
    }

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [rounds.length]);

  function jumpTo(round: number) {
    const container = scrollRef.current;
    const col = container?.querySelector<HTMLElement>(`[data-round="${round}"]`);
    if (container && col) {
      container.scrollTo({ left: col.offsetLeft - 12, behavior: "smooth" });
    }
  }

  return (
    <div>
      <div className="round-tabs">
        {rounds.map(([round, roundMatches]) => (
          <button key={round} type="button" className="round-tab" onClick={() => jumpTo(round)}>
            {roundLabel(night.kind, round, roundMatches.length)}
          </button>
        ))}
      </div>

      <div className="bracket-scroll" ref={scrollRef}>
        <div className="bracket" ref={bracketRef}>
          {rounds.map(([round, roundMatches], roundIdx) => {
            const gap = roundGaps?.[roundIdx];
            const gapStyle = gap
              ? ({
                  "--pair-gap": `${gap.pairGap}px`,
                  "--group-gap": `${gap.groupGap}px`,
                } as React.CSSProperties)
              : undefined;
            return (
              <div className="round-col" data-round={round} key={round} style={gapStyle}>
                <div className="round-title">{roundLabel(night.kind, round, roundMatches.length)}</div>
                <div className="round">
                  {groupPairs(roundMatches).map((pair, i) =>
                    pair.length === 2 ? (
                      <div className="pair" key={i}>
                        {pair.map((m) => (
                          <MatchCard
                            key={m.id}
                            match={m}
                            players={players}
                            highlightPlayerId={highlightPlayerId}
                            onSelectPlayer={onSelectPlayer}
                            compact
                          />
                        ))}
                      </div>
                    ) : (
                      <MatchCard
                        key={pair[0].id}
                        match={pair[0]}
                        players={players}
                        highlightPlayerId={highlightPlayerId}
                        onSelectPlayer={onSelectPlayer}
                        compact
                      />
                    )
                  )}
                </div>
              </div>
            );
          })}

          <div className="champion-col">
            <div className="round-title">Champion</div>
            <div className={`champion-box ${champion ? "champion-box-decided" : ""}`}>
              <span className="trophy">🏆</span>
              <span className="label">{champion ? champion.name : "TBC"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function groupPairs<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}
