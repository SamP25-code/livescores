// A player's results in qualifying competitions not run on this site (the
// Blackpool Masters' qualifiers, entered by the organiser), for their page:
// each competition they reached the recorded rounds of, with their matches,
// final first, and how they finished.
import { STAGE_LABEL, eventWinner, matchWinner, type QualifierEvent, type QualifierMatch } from "./qualifying";

export type PlayerQualifierMatch = {
  round: string;
  opponent: string;
  opponentId: string | null;
  mine: number | null;
  theirs: number | null;
  result: "won" | "lost" | "upcoming";
};

export type PlayerQualifier = {
  id: string;
  name: string;
  date: string | null;
  location: string | null;
  // "Winner" or "Runner-up" when they reached the final
  finish: "Winner" | "Runner-up" | null;
  matches: PlayerQualifierMatch[];
};

type EventLike = Pick<QualifierEvent, "id" | "name" | "location" | "final_date" | "results_depth" | "winner_person_id">;
type MatchLike = QualifierMatch & { qualifier_event_id: string };

export function buildPlayerQualifiers({
  personId,
  events,
  matches,
  names,
}: {
  personId: string;
  events: EventLike[];
  // Every match of those competitions (the final decides the winner)
  matches: MatchLike[];
  names: Map<string, string>;
}): PlayerQualifier[] {
  return events
    .map((e) => {
      const own = matches.filter((m) => m.qualifier_event_id === e.id);
      const winner = eventWinner(e, own);
      const final = own.find((m) => m.stage === 1 && m.slot === 0);
      const inFinal = Boolean(final && (final.person_a_id === personId || final.person_b_id === personId));
      const finish: PlayerQualifier["finish"] =
        winner === personId ? "Winner" : inFinal && winner ? "Runner-up" : null;
      const played = own
        .filter((m) => m.person_a_id === personId || m.person_b_id === personId)
        .sort((a, b) => a.stage - b.stage)
        .map((m): PlayerQualifierMatch => {
          const isA = m.person_a_id === personId;
          const opponentId = isA ? m.person_b_id : m.person_a_id;
          const won = matchWinner(m);
          return {
            round: STAGE_LABEL[m.stage] ?? "",
            opponent: opponentId ? (names.get(opponentId) ?? "Withdrawn player") : "TBC",
            opponentId,
            mine: isA ? m.score_a : m.score_b,
            theirs: isA ? m.score_b : m.score_a,
            result: won == null ? "upcoming" : won === personId ? "won" : "lost",
          };
        });
      return { id: e.id, name: e.name, date: e.final_date, location: e.location, finish, matches: played };
    })
    .filter((q) => q.finish || q.matches.length > 0)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
