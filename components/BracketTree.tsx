"use client";

import { useRef } from "react";
import { roundLabel } from "@/lib/bracket";
import MatchCard from "@/components/MatchCard";
import type { MatchRow, Night, Player } from "@/lib/types";

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
        <div className="bracket">
          {rounds.map(([round, roundMatches]) => (
            <div className="round-col" data-round={round} key={round}>
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
          ))}

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
