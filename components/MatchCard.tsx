import Avatar from "@/components/Avatar";
import FlashingScore from "@/components/FlashingScore";
import type { MatchRow, Player } from "@/lib/types";

/**
 * A single match, shared by the round-by-round list and the bracket tree
 * view - same avatars, same bold-winner/faded-loser treatment, same
 * flashing scores, same click-a-name-to-highlight-their-run behaviour,
 * just laid out differently by whichever parent renders it (`compact`
 * shrinks it to fit a narrow bracket column).
 */
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
  // A bye can land on either side - the original padding algorithm always
  // put it on B, but a no-show discovered mid-match (see markNoShow) clears
  // whichever side didn't turn up, so this checks for exactly one blank
  // side on an otherwise-decided match, not specifically which one.
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
