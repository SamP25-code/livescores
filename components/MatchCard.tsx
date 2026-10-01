"use client";

import { useState } from "react";
import FlashingScore from "@/components/FlashingScore";
import MatchHistory from "@/components/MatchHistory";
import type { MatchRow, Player } from "@/lib/types";

export default function MatchCard({
  match,
  players,
  drawNumbers,
  highlightPlayerId,
  onSelectPlayer,
  compact,
  historyEnabled = true,
  id,
}: {
  match: MatchRow;
  players: Record<string, Player>;
  drawNumbers?: Record<string, number>;
  highlightPlayerId?: string | null;
  onSelectPlayer?: (playerId: string) => void;
  compact?: boolean;
  historyEnabled?: boolean;
  id?: string;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const isBye = match.status === "complete" && Boolean(match.player_a_id) !== Boolean(match.player_b_id);
  const playerA = match.player_a_id ? players[match.player_a_id] : undefined;
  const playerB = match.player_b_id ? players[match.player_b_id] : undefined;
  const nameA = match.player_a_id ? playerA?.name ?? "TBC" : isBye ? "BYE" : "TBC";
  const nameB = match.player_b_id ? playerB?.name ?? "TBC" : isBye ? "BYE" : "TBC";
  const winnerA = Boolean(match.winner_id) && match.winner_id === match.player_a_id;
  const winnerB = Boolean(match.winner_id) && match.winner_id === match.player_b_id;
  const spotlightA = highlightPlayerId != null && match.player_a_id === highlightPlayerId;
  const spotlightB = highlightPlayerId != null && match.player_b_id === highlightPlayerId;
  // An empty first-round position still has its draw number, so a TBC
  // in round one reads as "number 2, not drawn yet".
  const numberA = match.player_a_id
    ? drawNumbers?.[match.player_a_id]
    : match.round === 1
      ? match.slot * 2 + 1
      : undefined;
  const numberB = match.player_b_id
    ? drawNumbers?.[match.player_b_id]
    : match.round === 1
      ? match.slot * 2 + 2
      : undefined;
  const upcoming = match.status === "upcoming";
  const scoreA = !match.player_a_id || upcoming ? "–" : match.score_a;
  const scoreB = !match.player_b_id || upcoming ? "–" : match.score_b;

  return (
    <div
      id={id}
      className={`card match ${compact ? "compact" : ""} ${match.status === "complete" ? "complete" : ""} ${
        isBye ? "bye" : ""
      }`}
    >
      {isBye ? (
        <div className="match-flag match-flag-muted">Bye</div>
      ) : (
        match.status === "live" && (
          <div className="match-flag match-flag-live">
            <span className="live-dot" />
            Live
          </div>
        )
      )}
      <div className="players">
        <div className={`player-row ${winnerA ? "winner" : ""} ${spotlightA ? "spotlight" : ""} ${nameA === "TBC" ? "tbc" : ""}`}>
          <NameCell
            player={playerA}
            name={nameA}
            showNumber={Boolean(drawNumbers)}
            number={numberA}
            playerId={match.player_a_id}
            onSelectPlayer={onSelectPlayer}
          />
          <FlashingScore value={scoreA} className={scoreA === "–" ? "score score-empty" : "score"} />
        </div>
        <hr className="divider" />
        <div className={`player-row ${winnerB ? "winner" : ""} ${spotlightB ? "spotlight" : ""} ${nameB === "TBC" ? "tbc" : ""}`}>
          <NameCell
            player={playerB}
            name={nameB}
            showNumber={Boolean(drawNumbers)}
            number={numberB}
            playerId={match.player_b_id}
            onSelectPlayer={onSelectPlayer}
          />
          <FlashingScore value={scoreB} className={scoreB === "–" ? "score score-empty" : "score"} />
        </div>
      </div>
      {historyEnabled && !compact && !isBye && match.status !== "upcoming" && (
        <div className="match-history-toggle-wrap">
          <button
            type="button"
            className="link-button match-history-toggle"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "Hide history" : "History"}
          </button>
          {showHistory && <MatchHistory matchId={match.id} nameA={playerA?.name} nameB={playerB?.name} />}
        </div>
      )}
    </div>
  );
}

function NameCell({
  player,
  name,
  number,
  showNumber,
  playerId,
  onSelectPlayer,
}: {
  player: Player | undefined;
  name: string;
  number?: number;
  showNumber: boolean;
  playerId: string | null;
  onSelectPlayer?: (playerId: string) => void;
}) {
  if (player && playerId && onSelectPlayer) {
    return (
      <button type="button" className="name-cell name-cell-button" onClick={() => onSelectPlayer(playerId)}>
        {showNumber && <DrawNumber number={number} />}
        <span className="name">{name}</span>
      </button>
    );
  }
  return (
    <span className="name-cell">
      {showNumber && <DrawNumber number={number} />}
      <span className="name">{name}</span>
    </span>
  );
}

// A blank pill keeps names lined up on rows with no number yet (a TBC in a
// later round).
function DrawNumber({ number }: { number?: number }) {
  if (number == null) return <span className="draw-number draw-number-blank" aria-hidden="true" />;
  return <span className="draw-number">{number}</span>;
}
