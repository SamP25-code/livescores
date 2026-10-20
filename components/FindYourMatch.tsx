"use client";

import { useState } from "react";
import { matchesSearch } from "@/lib/people";
import { yourMatch } from "@/lib/findMatch";
import PlayerName from "@/components/PlayerName";
import type { MatchRow, Player } from "@/lib/types";

// "Find your match": type a name to see where that player is - playing now,
// their next match and its time, or how they got on - and jump to it.
export default function FindYourMatch({
  players,
  matches,
  roundName,
  startTime,
  onShow,
}: {
  players: Record<string, Player>;
  matches: MatchRow[];
  roundName: (m: MatchRow) => string;
  startTime: (m: MatchRow) => string | null;
  onShow: (playerId: string, matchId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const names = Object.fromEntries(Object.values(players).map((p) => [p.id, p.name]));
  const found = query.trim().length >= 2
    ? Object.values(players)
        .filter((p) => !p.is_bye && matchesSearch(p.name, query))
        .map((p) => ({ player: p, match: yourMatch(p.id, matches, names, roundName, startTime) }))
        .filter((x): x is { player: Player; match: NonNullable<typeof x.match> } => x.match !== null)
        .slice(0, 4)
    : [];

  return (
    <div className="card find-match">
      <label htmlFor="find-your-match" className="find-match-label">
        Find your match
      </label>
      <input
        id="find-your-match"
        type="search"
        autoComplete="off"
        placeholder="Type your name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim().length >= 2 && found.length === 0 && <p className="hint">Nobody by that name in this draw.</p>}
      {found.map(({ player, match }) => (
        <div key={player.id} className="find-match-result">
          <span className="find-match-main">
            <PlayerName name={player.name} className="find-match-name" />
            <span className="find-match-headline">{match.headline}</span>
            <span className="hint">
              {match.round}
              {match.opponent ? ` · v ${match.opponent}` : ""}
            </span>
          </span>
          <button type="button" className="secondary" onClick={() => onShow(player.id, match.matchId)}>
            Show in the draw
          </button>
        </div>
      ))}
    </div>
  );
}
