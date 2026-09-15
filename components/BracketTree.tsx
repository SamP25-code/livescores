"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { roundLabel } from "@/lib/bracket";
import MatchCard from "@/components/MatchCard";
import type { MatchRow, Night, Player } from "@/lib/types";

const ROUND_ONE_PAIR_GAP = 10;
const ROUND_ONE_GROUP_GAP = 16;

type RoundGap = { pairGap: number; groupGap: number };

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
