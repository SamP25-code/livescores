"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import FlashingScore from "@/components/FlashingScore";
import MatchHistory from "@/components/MatchHistory";
import type { MatchRow, Player } from "@/lib/types";

export default function MatchCard({
  match,
  players,
  highlightPlayerId,
  onSelectPlayer,
  compact,
}: {
  match: MatchRow;
  players: Record<string, Player>;
  highlightPlayerId?: string | null;
  onSelectPlayer?: (playerId: string) => void;
  compact?: boolean;
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

  return (
    <div className={`card match ${compact ? "compact" : ""} ${match.status === "complete" ? "complete" : ""}`}>
      <div className="players">
        <div className={`player-row ${winnerA ? "winner" : ""} ${spotlightA ? "spotlight" : ""}`}>
          <NameCell player={playerA} name={nameA} playerId={match.player_a_id} onSelectPlayer={onSelectPlayer} />
          <FlashingScore value={match.player_a_id ? match.score_a : "–"} />
        </div>
        <hr className="divider" />
        <div className={`player-row ${winnerB ? "winner" : ""} ${spotlightB ? "spotlight" : ""}`}>
          <NameCell player={playerB} name={nameB} playerId={match.player_b_id} onSelectPlayer={onSelectPlayer} />
          <FlashingScore value={match.player_b_id ? match.score_b : "–"} />
        </div>
      </div>
      <span className={`status-pill ${match.status}`}>
        {match.status === "live" && <span className="live-dot" />}
        {isBye ? "bye" : match.status}
      </span>
      {!compact && !isBye && match.status !== "upcoming" && (
        <div className="match-history-toggle-wrap">
          <button
            type="button"
            className="link-button match-history-toggle"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "Hide history" : "History"}
          </button>
          {showHistory && <MatchHistory matchId={match.id} />}
        </div>
      )}
    </div>
  );
}

function NameCell({
  player,
  name,
  playerId,
  onSelectPlayer,
}: {
  player: Player | undefined;
  name: string;
  playerId: string | null;
  onSelectPlayer?: (playerId: string) => void;
}) {
  if (player && playerId && onSelectPlayer) {
    return (
      <button type="button" className="name-cell name-cell-button" onClick={() => onSelectPlayer(playerId)}>
        <Avatar name={player.name} />
        <span className="name">{name}</span>
      </button>
    );
  }
  return (
    <span className="name-cell">
      {player && <Avatar name={player.name} />}
      <span className="name">{name}</span>
    </span>
  );
}
